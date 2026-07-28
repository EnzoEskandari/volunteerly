import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#0F172A",
          50: "#F4F6F9",
          100: "#E2E7EF",
          200: "#C3CCDC",
          300: "#96A4BF",
          400: "#64769D",
          500: "#425477",
          600: "#2E3D5A",
          700: "#1F2B41",
          800: "#141D2E",
          900: "#0F172A",
          950: "#080D18",
        },
        brand: {
          DEFAULT: "#2563EB",
          50: "#EEF3FF",
          100: "#DCE7FE",
          200: "#BBD0FD",
          300: "#8FB1FA",
          400: "#5C8AF5",
          500: "#2563EB",
          600: "#1D4FD6",
          700: "#1A3FAB",
          800: "#193689",
          900: "#19316E",
        },
        emerald: {
          DEFAULT: "#10B981",
          50: "#ECFDF5",
          100: "#D1FAE9",
          200: "#A7F3D3",
          300: "#6EE7B7",
          400: "#34D399",
          500: "#10B981",
          600: "#059669",
          700: "#047857",
          800: "#065F46",
          900: "#064E3B",
        },
        surface: "#F8FAFC",
        ink: "#111827",
      },
      fontFamily: {
        // System-first stack (à la Stripe/Apple/LinkedIn): no external font
        // fetch required, renders instantly, and matches native OS text.
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "'Inter'",
          "'Segoe UI'",
          "Roboto",
          "'Helvetica Neue'",
          "Arial",
          "sans-serif",
        ],
        display: [
          "-apple-system",
          "BlinkMacSystemFont",
          "'Inter'",
          "'Segoe UI'",
          "sans-serif",
        ],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px -8px rgba(15, 23, 42, 0.10)",
        "card-hover": "0 4px 8px rgba(15, 23, 42, 0.06), 0 16px 40px -12px rgba(15, 23, 42, 0.16)",
        glow: "0 0 0 4px rgba(37, 99, 235, 0.10)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-500px 0" },
          "100%": { backgroundPosition: "500px 0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "fade-in": "fade-in 0.5s ease-out forwards",
        "scale-in": "scale-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        shimmer: "shimmer 2s infinite linear",
      },
    },
  },
  plugins: [],
};
export default config;
