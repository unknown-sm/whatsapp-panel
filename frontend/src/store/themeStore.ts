import { create } from "zustand";
import { persist } from "zustand/middleware";

type ThemeMode = "light" | "dark" | "system";

interface ThemeState {
  mode: ThemeMode;
  resolvedMode: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
}

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: "system",
      resolvedMode: getSystemTheme(),
      setMode: (mode) => {
        const resolved = mode === "system" ? getSystemTheme() : mode;
        set({ mode, resolvedMode: resolved });
        const root = document.documentElement;
        if (resolved === "dark") {
          root.classList.add("dark");
          root.classList.remove("light");
        } else {
          root.classList.add("light");
          root.classList.remove("dark");
        }
      },
    }),
    { name: "theme-storage" }
  )
);

// Initialize theme on load
export function initTheme() {
  const stored = localStorage.getItem("theme-storage");
  let mode: ThemeMode = "system";
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed.state?.mode) mode = parsed.state.mode;
    } catch { /* ignore */ }
  }
  const resolved = mode === "system" ? getSystemTheme() : mode;
  const root = document.documentElement;
  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.add("light");
  }
  // Listen for system changes when in system mode
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    const current = useThemeStore.getState();
    if (current.mode === "system") {
      const newMode = e.matches ? "dark" : "light";
      useThemeStore.setState({ resolvedMode: newMode });
      if (newMode === "dark") {
        root.classList.add("dark");
        root.classList.remove("light");
      } else {
        root.classList.add("light");
        root.classList.remove("dark");
      }
    }
  });
}
