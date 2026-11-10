import test from "node:test";
import assert from "node:assert/strict";
import { extractLocationFromPayload, formatLocationContent } from "../src/services/location.service";

test("extrae coordenadas, nombre y dirección de una ubicación de Meta", () => {
  const location = extractLocationFromPayload({
    location: {
      latitude: -25.2967,
      longitude: -57.6356,
      name: "  Local central  ",
      address: "  Asunción, Paraguay  ",
    },
  });

  assert.deepEqual(location, {
    latitude: -25.2967,
    longitude: -57.6356,
    name: "Local central",
    address: "Asunción, Paraguay",
  });
  assert.equal(formatLocationContent(location!), "Local central · Asunción, Paraguay");
});

test("acepta una ubicación solo con coordenadas y genera texto legible", () => {
  const location = extractLocationFromPayload({ location: { latitude: "-25.2967", longitude: "-57.6356" } });
  assert.deepEqual(location, { latitude: -25.2967, longitude: -57.6356, name: null, address: null });
  assert.equal(formatLocationContent(location!), "Ubicación compartida");
});

test("rechaza coordenadas ausentes, no numéricas o fuera de rango", () => {
  assert.equal(extractLocationFromPayload({ location: { longitude: -57.6356 } }), null);
  assert.equal(extractLocationFromPayload({ location: { latitude: null, longitude: -57.6356 } }), null);
  assert.equal(extractLocationFromPayload({ location: { latitude: "", longitude: -57.6356 } }), null);
  assert.equal(extractLocationFromPayload({ location: { latitude: "norte", longitude: -57.6356 } }), null);
  assert.equal(extractLocationFromPayload({ location: { latitude: 91, longitude: -57.6356 } }), null);
  assert.equal(extractLocationFromPayload({ location: { latitude: -25.2967, longitude: 181 } }), null);
  assert.equal(extractLocationFromPayload({ text: { body: "hola" } }), null);
});
