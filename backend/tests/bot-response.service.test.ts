import test from "node:test";
import assert from "node:assert/strict";
import { prepareBotResponse } from "../src/services/bot-response.service";

const knowledge = `PAGINA_ORIGEN: https://seiva.com.py/catalogo
IMAGENES_PRODUCTO:
- https://cdn.seiva.com.py/departamento.jpg
- https://cdn.seiva.com.py/casa.jpg`;

test("una recomendación puntual puede incluir una imagen conocida con su ficha", () => {
  const result = prepareBotResponse(
    "Encontré esta opción.\n[[IMAGEN:https://cdn.seiva.com.py/departamento.jpg]]",
    "¿Tenés un departamento en Del Valle?",
    knowledge,
  );
  assert.equal(result.text, "Encontré esta opción.");
  assert.equal(result.imageUrl, "https://cdn.seiva.com.py/departamento.jpg");
  assert.equal(result.catalogRequested, false);
});

test("aunque la IA genere varias imágenes solo se conserva la primera", () => {
  const result = prepareBotResponse(
    "Opciones:\n[[IMAGEN:https://cdn.seiva.com.py/departamento.jpg]]\n[[IMAGEN:https://cdn.seiva.com.py/casa.jpg]]",
    "Recomiéndame uno",
    knowledge,
  );
  assert.equal(result.imageUrl, "https://cdn.seiva.com.py/departamento.jpg");
  assert.equal(result.text, "Opciones:");
});

test("una imagen inventada por la IA se elimina y no se envía", () => {
  const result = prepareBotResponse(
    "Mirá esta foto [[IMAGEN:https://externo.example/inventada.jpg]]",
    "Quiero una foto",
    knowledge,
  );
  assert.equal(result.imageUrl, null);
  assert.equal(result.text, "Mirá esta foto");
});

test("una solicitud de varios productos suprime fotos y deriva a la web", () => {
  const result = prepareBotResponse(
    "Tengo tres opciones. [[IMAGEN:https://cdn.seiva.com.py/departamento.jpg]]",
    "Quiero ver varios productos",
    knowledge,
  );
  assert.equal(result.catalogRequested, true);
  assert.equal(result.imageUrl, null);
  assert.match(result.text, /^Tengo tres opciones\./);
  assert.match(result.text, /https:\/\/seiva\.com\.py\/catalogo/);
  assert.doesNotMatch(result.text, /\[\[IMAGEN:/);
});

test("una respuesta normal sin imágenes permanece igual", () => {
  const result = prepareBotResponse("Hola, ¿en qué puedo ayudarte?", "Hola", knowledge);
  assert.equal(result.text, "Hola, ¿en qué puedo ayudarte?");
  assert.equal(result.imageUrl, null);
});
