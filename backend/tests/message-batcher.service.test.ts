import test from "node:test";
import assert from "node:assert/strict";
import { MessageBatcher } from "../src/services/message-batcher.service";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("agrupa mensajes consecutivos y ejecuta una sola respuesta", async () => {
  const batches: string[][] = [];
  const batcher = new MessageBatcher<string>(50, async (_key, items) => {
    batches.push(items);
  });

  batcher.push("conversation-1", "Hola");
  await sleep(15);
  batcher.push("conversation-1", "¿Tienen disponible");
  await sleep(15);
  batcher.push("conversation-1", "el colágeno de 85 mil");
  await sleep(15);
  batcher.push("conversation-1", "y de dónde son?");
  await sleep(80);

  assert.deepEqual(batches, [["Hola", "¿Tienen disponible", "el colágeno de 85 mil", "y de dónde son?"]]);
});

test("mantiene independientes las conversaciones de distintos clientes", async () => {
  const batches: { key: string; items: string[] }[] = [];
  const batcher = new MessageBatcher<string>(30, async (key, items) => {
    batches.push({ key, items });
  });

  batcher.push("conversation-1", "Hola");
  batcher.push("conversation-2", "Precio");
  batcher.push("conversation-1", "¿Está disponible?");
  await sleep(60);

  assert.equal(batches.length, 2);
  assert.deepEqual(batches.find((batch) => batch.key === "conversation-1")?.items, ["Hola", "¿Está disponible?"]);
  assert.deepEqual(batches.find((batch) => batch.key === "conversation-2")?.items, ["Precio"]);
});

test("cada mensaje nuevo reinicia el período de silencio", async () => {
  const batches: string[][] = [];
  const batcher = new MessageBatcher<string>(60, async (_key, items) => {
    batches.push(items);
  });

  batcher.push("conversation-1", "primera parte");
  await sleep(40);
  batcher.push("conversation-1", "segunda parte");
  await sleep(35);
  assert.equal(batches.length, 0);
  await sleep(40);
  assert.deepEqual(batches, [["primera parte", "segunda parte"]]);
});
