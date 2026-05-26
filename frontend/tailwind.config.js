/** @type {import("tailwindcss").Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "system-ui", "-apple-system", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      colors: {
        accent: {
          50: "#e8faf0",
          100: "#d1f5e0",
          200: "#a3ebc1",
          300: "#75e1a2",
          400: "#47d783",
          500: "#25d366",
          600: "#1da851",
          700: "#16803d",
          800: "#0e5829",
          900: "#073015",
        },
        whatsapp: "#25D366",
        whatsappDark: "#128C7E",
        surface: {
          DEFAULT: "var(--bg-surface)",
          elevated: "var(--bg-elevated)",
          hover: "var(--bg-hover)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          tertiary: "var(--text-tertiary)",
        },
      },
    },
  },
  plugins: [],
};
