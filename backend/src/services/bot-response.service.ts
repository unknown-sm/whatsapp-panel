const IMAGE_DIRECTIVE = /\[\[IMAGEN:\s*(https?:\/\/[^\s\]]+)\s*\]\]/gi;
const CATALOG_REQUEST = /\b(cat[aá]logo|varios|varias|muchos|muchas|todos|todas|comparar|compara|opciones|ver m[aá]s|otros productos|otras opciones)\b/i;
const VISUAL_REQUEST = /\b(foto|fotos|imagen|im[aá]genes|ver|mostr[aá]|mostrame|mand[aá]|mandame)\b/i;
const GENERIC_PRODUCT_TOKENS = new Set(["de", "del", "el", "la", "y", "con", "combo", "producto"]);

export type ConversationMessage = { role: string; content: string };
type ProductMedia = { name: string; pageUrl: string; imageUrl: string };

export type PreparedBotResponse = {
  text: string;
  imageUrl: string | null;
  catalogRequested: boolean;
};

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function productMediaFromKnowledge(knowledge: string): ProductMedia[] {
  const pattern = /^PRODUCTO:[ \t]*(.+?)[ \t]*\r?\nFICHA_PRODUCTO:[ \t]*(\S+)[ \t]*\r?\nIMAGEN_PRODUCTO:[ \t]*(\S+)[ \t]*$/gm;
  return [...knowledge.matchAll(pattern)].map((match) => ({
    name: match[1], pageUrl: match[2], imageUrl: match[3],
  }));
}

/** Devuelve un producto solo si hay un único ganador; un empate es ambiguo. */
function bestProductMatch(text: string, products: ProductMedia[]): ProductMedia | null {
  // Comparar tokens completos: includes("6") haría que "Berberina 60"
  // coincidiera indebidamente con un producto "Omega 3-6-9".
  const normalizedTokens = new Set(normalize(text).split(" "));
  const scores = products.map((product) => {
    const tokens = normalize(product.name).split(" ")
      .filter((token) => token && !GENERIC_PRODUCT_TOKENS.has(token));
    const score = new Set(tokens.filter((token) => normalizedTokens.has(token))).size;
    return { product, score };
  }).filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!scores.length || (scores.length > 1 && scores[0].score === scores[1].score)) return null;
  return scores[0].product;
}

function selectedOption(userMessage: string): number | null {
  const normalized = normalize(userMessage);
  const numeric = normalized.match(/^(?:(?:el|la|opcion) )?(\d{1,2})$/);
  if (numeric) return Number(numeric[1]);
  const ordinals: Record<string, number> = { primero: 1, primera: 1, segundo: 2, segunda: 2, tercero: 3, tercera: 3 };
  const ordinal = normalized.match(/^(?:(?:el|la) )?(primero|primera|segundo|segunda|tercero|tercera)$/);
  return ordinal ? ordinals[ordinal[1]] : null;
}

/** Resuelve “1” contra la última lista numerada que vio el cliente. */
function productFromNumberedList(userMessage: string, history: ConversationMessage[], products: ProductMedia[]): ProductMedia | null {
  const option = selectedOption(userMessage);
  if (!option) return null;
  const lastAssistant = [...history].reverse().find((message) => message.role === "assistant");
  if (!lastAssistant) return null;
  for (const line of lastAssistant.content.split(/\r?\n/)) {
    const match = line.match(/^\s*[-*]*\s*(\d{1,2})(?:\s*[.)]|\uFE0F?\u20E3)/);
    if (Number(match?.[1]) === option) return bestProductMatch(line, products);
  }
  return null;
}

/**
 * Convierte la respuesta de IA en texto + una imagen como máximo.
 * Solo acepta imágenes presentes en el conocimiento importado: la IA no puede
 * inventar una URL y hacer que el bot la envíe a un cliente.
 */
export function prepareBotResponse(
  response: string,
  userMessage: string,
  knowledge: string,
  history: ConversationMessage[] = [],
): PreparedBotResponse {
  const catalogRequested = CATALOG_REQUEST.test(userMessage);
  const directives = [...response.matchAll(IMAGE_DIRECTIVE)];
  const candidate = directives[0]?.[1] || null;
  const knownImage = candidate && knowledge.includes(candidate) ? candidate : null;
  const products = productMediaFromKnowledge(knowledge);
  const selectedProduct = productFromNumberedList(userMessage, history, products)
    || (VISUAL_REQUEST.test(userMessage) ? bestProductMatch(userMessage, products) : null);
  // Si el cliente eligió una opción pero no pudimos vincularla con un producto
  // que tenga imagen importada, no uses el marcador de la IA como fallback:
  // podría corresponder a otra opción o a una conversación anterior.
  const unresolvedNumericSelection = selectedOption(userMessage) !== null && !selectedProduct;
  const catalogUrl = knowledge.match(/^PAGINA_ORIGEN:\s*(https?:\/\/\S+)\s*$/m)?.[1] || null;

  let text = response.replace(IMAGE_DIRECTIVE, "").replace(/\n{3,}/g, "\n\n").trim();
  if (catalogRequested && catalogUrl && !text.includes(catalogUrl)) {
    text = `${text}${text ? "\n\n" : ""}Podés ver todos los productos y sus fotos acá: ${catalogUrl}`;
  }

  return {
    text,
    imageUrl: catalogRequested || unresolvedNumericSelection ? null : selectedProduct?.imageUrl || knownImage,
    catalogRequested,
  };
}
