/* ═══════════════════════════════════════════════════════════
   resolveAccentSet — Derives hover/soft/tint/text from one hex
   Ensures WCAG contrast ≥ 3:1 with white for text
   ═══════════════════════════════════════════════════════════ */

export interface AccentSet {
  accent: string;
  hover: string;
  soft: string;
  tint: string;
  text: string;
}

const ACCENT_PRESETS: Record<string, string> = {
  "azul-acero": "#3f5972",
  "grafito":    "#3e3e47",
  "verde-apagado": "#4a6b5a",
  "ciruela":    "#5a4a5e",
};

/* ── Color math ──────────────────────────────────────── */

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.substring(0, 2), 16),
    parseInt(clean.substring(2, 4), 16),
    parseInt(clean.substring(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}

function mix(a: [number, number, number], b: [number, number, number], weight: number): [number, number, number] {
  return [
    a[0] * (1 - weight) + b[0] * weight,
    a[1] * (1 - weight) + b[1] * weight,
    a[2] * (1 - weight) + b[2] * weight,
  ];
}

function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/* ── Main resolver ─────────────────────────────────────── */

export function resolveAccentSet(accentHex: string): AccentSet {
  const accent = hexToRgb(accentHex);
  const WHITE: [number, number, number] = [255, 255, 255];

  // hover: darken 8%
  const hover = mix(accent, [0, 0, 0], 0.08);

  // soft: accent mixed with white at ~88% white (light tint for backgrounds)
  let soft = mix(accent, WHITE, 0.88);

  // tint: even lighter (for active nav bg)
  let tint = mix(accent, WHITE, 0.94);

  // text: start as accent, darken until WCAG ≥ 3:1 with white
  let text = [...accent] as [number, number, number];
  let darkenStep = 0;
  while (contrastRatio(text, WHITE) < 3.0 && darkenStep < 30) {
    text = mix(text, [0, 0, 0], 0.05);
    darkenStep++;
  }

  return {
    accent: accentHex,
    hover: rgbToHex(...hover),
    soft: rgbToHex(...soft),
    tint: rgbToHex(...tint),
    text: rgbToHex(...text),
  };
}

/* ── CSS variables string for injection ─────────────────── */

export function accentToCssVars(accentHex: string): string {
  const set = resolveAccentSet(accentHex);
  return [
    `--accent:${set.accent}`,
    `--accent-hover:${set.hover}`,
    `--accent-soft:${set.soft}`,
    `--accent-tint:${set.tint}`,
    `--accent-text:${set.text}`,
  ].join(";");
}

/* ── Inject into <html> before first render ────────────── */

export function injectAccent(accentHex: string): void {
  const vars = accentToCssVars(accentHex);
  document.documentElement.setAttribute("style", vars);
}

/* ── Presets ────────────────────────────────────────────── */

export function getPresetAccent(presetName: string): string | null {
  return ACCENT_PRESETS[presetName] || null;
}

export function getPresetList(): { name: string; label: string; hex: string }[] {
  return [
    { name: "azul-acero", label: "Azul acero", hex: ACCENT_PRESETS["azul-acero"] },
    { name: "grafito", label: "Grafito", hex: ACCENT_PRESETS["grafito"] },
    { name: "verde-apagado", label: "Verde apagado", hex: ACCENT_PRESETS["verde-apagado"] },
    { name: "ciruela", label: "Ciruela", hex: ACCENT_PRESETS["ciruela"] },
  ];
}