import { type HTMLAttributes } from "react";

/* ═══════════════════════════════════════════════════════════
   Avatar — Iniciales sobre 8 swatches desaturados por hash
   ═══════════════════════════════════════════════════════════ */

const SWATCHES = [
  "#5a6b7c", // steel
  "#54585f", // slate
  "#5e6b5a", // sage
  "#7a7268", // taupe
  "#8a6f64", // clay
  "#6b5e7a", // dusk
  "#4f6b6b", // teal
  "#4a4a52", // graphite
];

function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getInitials(name: string | null | undefined, fallback: string = "?"): string {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  id: string;
  name?: string | null;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "w-6 h-6 text-[11px]",
  md: "w-8 h-8 text-xs",
  lg: "w-12 h-12 text-base",
};

export function Avatar({ id, name, size = "md", className, ...props }: AvatarProps) {
  const swatchIndex = hashId(id) % SWATCHES.length;
  const bg = SWATCHES[swatchIndex];
  const initials = getInitials(name);

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full font-medium text-white shrink-0 ${sizeClasses[size]} ${className || ""}`}
      style={{ background: bg }}
      title={name || initials}
      {...props}
    >
      {initials}
    </div>
  );
}