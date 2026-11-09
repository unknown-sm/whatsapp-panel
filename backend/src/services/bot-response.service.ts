const IMAGE_DIRECTIVE = /\[\[IMAGEN:\s*(https?:\/\/[^\s\]]+)\s*\]\]/gi;
const CATALOG_REQUEST = /\b(cat[aá]logo|varios|varias|muchos|muchas|todos|todas|comparar|compara|opciones|ver m[aá]s|otros productos|otras opciones)\b/i;

export type PreparedBotResponse = {
  text: string;
  imageUrl: string | null;
  catalogRequested: boolean;
};

/**
 * Convierte la respuesta de IA en texto + una imagen como máximo.
 * Solo acepta imágenes presentes en el conocimiento importado: la IA no puede
 * inventar una URL y hacer que el bot la envíe a un cliente.
 */
export function prepareBotResponse(response: string, userMessage: string, knowledge: string): PreparedBotResponse {
  const catalogRequested = CATALOG_REQUEST.test(userMessage);
  const directives = [...response.matchAll(IMAGE_DIRECTIVE)];
  const candidate = directives[0]?.[1] || null;
  const knownImage = candidate && knowledge.includes(candidate) ? candidate : null;
  const catalogUrl = knowledge.match(/^PAGINA_ORIGEN:\s*(https?:\/\/\S+)\s*$/m)?.[1] || null;

  let text = response.replace(IMAGE_DIRECTIVE, "").replace(/\n{3,}/g, "\n\n").trim();
  if (catalogRequested && catalogUrl && !text.includes(catalogUrl)) {
    text = `${text}${text ? "\n\n" : ""}Podés ver todos los productos y sus fotos acá: ${catalogUrl}`;
  }

  return {
    text,
    imageUrl: catalogRequested ? null : knownImage,
    catalogRequested,
  };
}
