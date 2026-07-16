/** @type {import("tailwindcss").Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Geist"', '"Plus Jakarta Sans"', "system-ui", "-apple-system", "sans-serif"],
        mono: ['"Geist Mono"', '"JetBrains Mono"', "monospace"],
      },
      letterSpacing: {
        tight: "-0.01em",
        tighter: "-0.025em",
      },
      fontSize: {
        "17px": "17px",
        "13px": "13px",
        "11.5px": "11.5px",
      },
      fontWeight: {
        "650": "650",
      },
      colors: {
        /* ── Atlas semantic tokens (bridge to shadcn names) ── */
        background:      "var(--bg)",
        foreground:      "var(--text)",
        card:            "var(--bg)",
        "card-foreground":"var(--text)",
        popover:         "var(--bg)",
        "popover-foreground":"var(--text)",
        primary:         "var(--accent)",
        "primary-foreground":"var(--text-inverse)",
        secondary:       "var(--bg-hover)",
        "secondary-foreground":"var(--text)",
        muted:           "var(--bg-panel)",
        "muted-foreground":"var(--text-2)",
        accent:          "var(--accent-soft)",
        "accent-foreground":"var(--accent-text)",
        destructive:     "var(--danger)",
        "destructive-foreground":"var(--text-inverse)",
        border:          "var(--border)",
        input:           "var(--border)",
        ring:            "var(--accent)",

        /* ── Brand scale (white-label accent) ──────────── */
        brand: {
          DEFAULT: "var(--accent)",
          hover:   "var(--accent-hover)",
          soft:    "var(--accent-soft)",
          tint:    "var(--accent-tint)",
          text:    "var(--accent-text)",
        },

        /* ── Atlas neutrals ────────────────────────────── */
        atlas: {
          bg:      "var(--bg)",
          subtle:  "var(--bg-subtle)",
          panel:   "var(--bg-panel)",
          hover:   "var(--bg-hover)",
          active:  "var(--bg-active)",
          muted:   "var(--bg-muted)",
        },

        /* ── Text scale ─────────────────────────────── */
        ink: {
          DEFAULT: "var(--text)",
          2:       "var(--text-2)",
          3:       "var(--text-3)",
          4:       "var(--text-4)",
          inverse: "var(--text-inverse)",
        },

        /* ── Desaturated status ─────────────────────── */
        success: "var(--success)",
        warning: "var(--warning)",
        danger:  "var(--danger)",

        /* ── Chat ──────────────────────────────────── */
        chat: {
          bg:          "var(--chat-bg)",
          "bubble-out": "var(--bubble-out)",
          "bubble-out-text": "var(--bubble-out-text)",
          "bubble-in":  "var(--bubble-in)",
          "bubble-in-text":  "var(--bubble-in-text)",
        },

        /* ── Warn chip (Lab findings) ───────────────── */
        warn: {
          chip: {
            bg:     "var(--warn-chip-bg)",
            border: "var(--warn-chip-border)",
            text:   "var(--warn-chip-text)",
          },
        },

        /* ── Legacy aliases (backward compat) ──────── */
        whatsapp:     "var(--accent)",
        whatsappDark: "var(--accent-hover)",
        surface: {
          DEFAULT: "var(--bg)",
          elevated: "var(--bg-subtle)",
          hover:    "var(--bg-hover)",
        },
        text: {
          primary:   "var(--text)",
          secondary: "var(--text-2)",
          tertiary:  "var(--text-3)",
        },
      },
      borderRadius: {
        sm:  "var(--radius-sm)",
        DEFAULT: "var(--radius-md)",
        md:  "var(--radius-md)",
        lg:  "var(--radius-lg)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        pop: "var(--shadow-pop)",
        lg: "var(--shadow-md)",
        xl: "var(--shadow-pop)",
      },
    },
  },
  plugins: [],
};