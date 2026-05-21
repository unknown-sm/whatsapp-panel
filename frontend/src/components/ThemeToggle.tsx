import { useState, useRef, useEffect } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useThemeStore } from "../store/themeStore";

export default function ThemeToggle() {
  const { mode, setMode } = useThemeStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(evt: MouseEvent) {
      if (ref.current && !ref.current.contains(evt.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const options = [
    { key: "light", label: "Claro", Icon: Sun },
    { key: "dark", label: "Oscuro", Icon: Moon },
    { key: "system", label: "Sistema", Icon: Monitor },
  ] as const;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-9 h-9 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-default)] hover:border-[var(--border-hover)] transition-colors"
        aria-label="Cambiar tema"
      >
        {mode === "light" ? <Sun size={18} /> : mode === "dark" ? <Moon size={18} /> : <Monitor size={18} />}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-40 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-default)] shadow-lg shadow-black/20 overflow-hidden z-50">
          {options.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => { setMode(key as any); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${mode === key ? "bg-[var(--accent-muted)] text-[var(--accent)] font-medium" : "text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"}`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
