import test from "node:test";
import assert from "node:assert/strict";
import {
  WEBHOOK_MAX_ATTEMPTS,
  enqueueWebhookEvent,
  extractPhoneNumberId,
  processWebhookEvent,
  recoverStuckWebhookEvents,
  retryDelayMs,
  webhookEventKey,
} from "../src/services/webhook-event.service";

const payload = {
  entry: [{
    changes: [{
      value: {
        metadata: { phone_number_id: "phone-1" },
        messages: [{ id: "wamid.1", from: "595981000000", text: { body: "hola" } }],
      },
    }],
  }],
};

function fakeEnqueueDb(existing?: any) {
  return {
    whatsappConfig: {
      findFirst: async () => ({ id: "config-1", orgId: "org-1" }),
      update: async () => ({}),
    },
    organization: { findFirst: async () => ({ id: "org-1" }) },
    webhookEvent: {
      create: async ({ data }: any) => {
        if (existing) throw Object.assign(new Error("Unique constraint"), { code: "P2002" });
        return { id: "event-new", ...data };
      },
      findUnique: async () => existing,
    },
  };
}

function fakeWorkerDb(initial: any) {
  const event = { ...initial };
  return {
    event,
    webhookEvent: {
      updateMany: async () => {
        if (event.status !== "pending" || event.attempts >= WEBHOOK_MAX_ATTEMPTS) return { count: 0 };
        event.status = "processing";
        event.attempts += 1;
        return { count: 1 };
      },
      findUnique: async () => ({ ...event }),
      update: async ({ data }: any) => {
        Object.assign(event, data);
        return { ...event };
      },
    },
  };
}

test("la huella es estable y distingue payloads diferentes", () => {
  assert.equal(webhookEventKey("abc"), webhookEventKey(Buffer.from("abc")));
  assert.notEqual(webhookEventKey("abc"), webhookEventKey("abd"));
  assert.match(webhookEventKey("abc"), /^sha256:[a-f0-9]{64}$/);
});

test("extrae phoneNumberId aunque el evento tenga varios cambios", () => {
  assert.equal(extractPhoneNumberId(payload), "phone-1");
  assert.equal(extractPhoneNumberId({ entry: [] }), null);
});

test("los reintentos usan espera exponencial con tope", () => {
  assert.equal(retryDelayMs(1), 5000);
  assert.equal(retryDelayMs(2), 10000);
  assert.equal(retryDelayMs(3), 20000);
  assert.equal(retryDelayMs(20), 300000);
});

test("guarda un evento nuevo con su organización y número", async () => {
  const rawBody = Buffer.from(JSON.stringify(payload));
  const result = await enqueueWebhookEvent({ payload, rawBody }, fakeEnqueueDb());
  assert.equal(result.isNew, true);
  assert.equal(result.event.orgId, "org-1");
  assert.equal(result.event.phoneNumberId, "phone-1");
  assert.equal(result.event.status, "pending");
  assert.equal(result.event.eventKey, webhookEventKey(rawBody));
});

test("ante UNIQUE concurrente reutiliza el evento y no crea otro", async () => {
  const existing = { id: "event-existing", status: "done", eventKey: webhookEventKey(JSON.stringify(payload)) };
  const result = await enqueueWebhookEvent(
    { payload, rawBody: Buffer.from(JSON.stringify(payload)) },
    fakeEnqueueDb(existing),
  );
  assert.equal(result.isNew, false);
  assert.equal(result.event.id, "event-existing");
});

test("el worker procesa una vez y marca done", async () => {
  const db = fakeWorkerDb({ id: "event-1", status: "pending", attempts: 0, orgId: "org-1", payload });
  let calls = 0;
  const result = await processWebhookEvent("event-1", {
    db,
    processPayload: async (received, orgId) => {
      calls += 1;
      assert.deepEqual(received, payload);
      assert.equal(orgId, "org-1");
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.status, "done");
  assert.equal(db.event.status, "done");
  assert.equal(db.event.attempts, 1);
  assert.ok(db.event.processedAt instanceof Date);

  const second = await processWebhookEvent("event-1", { db, processPayload: async () => { calls += 1; } });
  assert.equal(second.reason, "not_claimable");
  assert.equal(calls, 1);
});

test("un error vuelve a pending y conserva el motivo", async () => {
  const db = fakeWorkerDb({ id: "event-2", status: "pending", attempts: 0, orgId: "org-1", payload });
  const result = await processWebhookEvent("event-2", {
    db,
    processPayload: async () => { throw new Error("IA no disponible"); },
  });
  assert.equal(result.status, "pending");
  assert.equal(db.event.status, "pending");
  assert.equal(db.event.attempts, 1);
  assert.equal(db.event.lastError, "IA no disponible");
  assert.ok(db.event.nextRetryAt.getTime() > Date.now());
});

test("al quinto error queda failed y deja de reintentar", async () => {
  const db = fakeWorkerDb({ id: "event-3", status: "pending", attempts: 4, orgId: "org-1", payload });
  const result = await processWebhookEvent("event-3", {
    db,
    processPayload: async () => { throw new Error("fallo permanente"); },
  });
  assert.equal(result.status, "failed");
  assert.equal(db.event.status, "failed");
  assert.equal(db.event.attempts, WEBHOOK_MAX_ATTEMPTS);

  const again = await processWebhookEvent("event-3", { db });
  assert.equal(again.reason, "not_claimable");
});

test("recupera eventos processing abandonados por un reinicio", async () => {
  let captured: any;
  const db = {
    webhookEvent: {
      updateMany: async (args: any) => {
        captured = args;
        return { count: 2 };
      },
    },
  };
  const count = await recoverStuckWebhookEvents(db);
  assert.equal(count, 2);
  assert.equal(captured.where.status, "processing");
  assert.equal(captured.data.status, "pending");
  assert.ok(captured.where.updatedAt.lt instanceof Date);
});
