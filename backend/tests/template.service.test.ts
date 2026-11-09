import test from "node:test";
import assert from "node:assert/strict";
import { sendTemplate } from "../src/services/template.service";

function fakeDb(status = "APPROVED") {
  return {
    whatsappConfig: {
      findFirst: async () => ({ phoneNumberId: "phone-number-1", accessToken: "EAA-test-token" }),
    },
    messageTemplate: {
      findFirst: async () => ({
        id: "template-1",
        name: "seguimiento_cliente",
        language: "es_PY",
        status,
      }),
    },
  };
}

test("envía nombre, idioma y un único componente body con todas las variables", async () => {
  let request: any;
  const post = async (url: string, body: any, config: any) => {
    request = { url, body, config };
    return { data: { messages: [{ id: "wamid.test" }] } };
  };

  const result = await sendTemplate("595981000000", "template-1", ["Ana", "250000"], "org-1", { db: fakeDb(), post });

  assert.equal(result.messages[0].id, "wamid.test");
  assert.equal(request.url, "https://graph.facebook.com/v21.0/phone-number-1/messages");
  assert.deepEqual(request.body, {
    messaging_product: "whatsapp",
    to: "595981000000",
    type: "template",
    template: {
      name: "seguimiento_cliente",
      language: { code: "es_PY" },
      components: [{
        type: "body",
        parameters: [
          { type: "text", text: "Ana" },
          { type: "text", text: "250000" },
        ],
      }],
    },
  });
  assert.equal(request.config.headers.Authorization, "Bearer EAA-test-token");
});

test("rechaza un template no aprobado sin llamar a Meta", async () => {
  let metaCalls = 0;
  const post = async () => {
    metaCalls++;
    return { data: {} };
  };

  await assert.rejects(
    sendTemplate("595981000000", "template-1", [], "org-1", { db: fakeDb("PENDING"), post }),
    /Template no aprobado/,
  );
  assert.equal(metaCalls, 0);
});

test("propaga el rechazo de Meta para que el inbox no persista el envío", async () => {
  const metaError = Object.assign(new Error("Request failed with status code 400"), {
    response: { data: { error: { code: 132001 } } },
  });
  const post = async () => { throw metaError; };

  await assert.rejects(
    sendTemplate("595981000000", "template-1", [], "org-1", { db: fakeDb(), post }),
    (error) => error === metaError,
  );
});
