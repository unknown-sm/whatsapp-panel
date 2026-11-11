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

test("una ficha JSON-LD asocia el nombre del combo con su imagen principal", () => {
  const result = buildWebKnowledge(`
    <html><head>
      <meta property="og:image" content="https://seiva.com.py/img/productos/combo-og.jpg">
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"Omega 3 Puro 1000mg + Magnesio citrato 120caps combo",
        "url":"https://seiva.com.py/producto/omega-3-puro-combo",
        "image":["https://seiva.com.py/omega-3-puro-combo.jpeg"]
      }</script>
    </head><body><h1>Omega 3 Puro + Magnesio</h1>
    <p>Combo de dos frascos disponible para entrega con precio actualizado.</p></body></html>
  `, new URL("https://seiva.com.py/producto/omega-3-puro-combo"));

  assert.match(result, /PRODUCTO: Omega 3 Puro 1000mg \+ Magnesio citrato 120caps combo/);
  assert.match(result, /FICHA_PRODUCTO: https:\/\/seiva\.com\.py\/producto\/omega-3-puro-combo/);
  assert.match(result, /IMAGEN_PRODUCTO: https:\/\/seiva\.com\.py\/img\/productos\/combo-og\.jpg/);
  const imageList = result.split("IMAGENES_PRODUCTO:")[1];
  assert.ok(imageList.indexOf("combo-og.jpg") < imageList.indexOf("omega-3-puro-combo.jpeg"));
});

test("un JSON-LD inválido no impide conservar las imágenes públicas", () => {
  const result = buildWebKnowledge(`
    <html><head><script type="application/ld+json">{inválido}</script>
    <meta property="og:image" content="/combo.jpg"></head>
    <body><p>Descripción suficientemente extensa del combo disponible en la tienda.</p></body></html>
  `, new URL("https://seiva.com.py/producto/combo"));

  assert.doesNotMatch(result, /IMAGEN_PRODUCTO:/);
  assert.match(result, /- https:\/\/seiva\.com\.py\/combo\.jpg/);
});
