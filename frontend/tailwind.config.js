/** @type {import("tailwindcss").Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Keep brand colors as static Tailwind classes
        accent: {
          50: "#e6f4ea",
          100: "#ccebd5",
          200: "#99d7ab", 
          300: "#66c381",
          400: "#33af57",
          500: "#009b2d", // primary accent (WhatsApp green)
          600: "#007a24",
          700: "#005a1b",
          800: "#003b12",
          900: "#001d09",
        },
        whatsapp: "#25D366",
        whatsappDark: "#128C7E",
        // CSS variable references (optional for advanced use)
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
