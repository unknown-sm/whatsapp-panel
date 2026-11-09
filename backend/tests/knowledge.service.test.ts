import test from "node:test";
import assert from "node:assert/strict";
import { buildWebKnowledge } from "../src/services/knowledge.service";

test("la importación web conserva origen, texto e imágenes públicas de producto", () => {
  const result = buildWebKnowledge(`
    <html><head><meta property="og:image" content="https://cdn.seiva.com.py/portada.jpg"></head>
    <body><h1>Catálogo Seiva</h1><p>Departamentos y casas disponibles con precios actualizados para consulta.</p>
    <img src="/productos/departamento.jpg"><img data-src="https://cdn.seiva.com.py/casa.jpg">
    <img src="/assets/logo.svg"><img src="data:image/png;base64,abc"></body></html>
  `, new URL("https://seiva.com.py/catalogo"));

  assert.match(result, /PAGINA_ORIGEN: https:\/\/seiva\.com\.py\/catalogo/);
  assert.match(result, /https:\/\/cdn\.seiva\.com\.py\/portada\.jpg/);
  assert.match(result, /https:\/\/seiva\.com\.py\/productos\/departamento\.jpg/);
  assert.match(result, /https:\/\/cdn\.seiva\.com\.py\/casa\.jpg/);
  assert.doesNotMatch(result, /logo\.svg/);
  assert.doesNotMatch(result, /data:image/);
  assert.match(result, /Departamentos y casas disponibles/);
});
