/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      colors: {
        // Brand JXB
        primary: {
          50: "#EFF5FE",
          100: "#D9E6FC",
          200: "#B6CEFA",
          300: "#8BABF5",
          400: "#5C86EE",
          500: "#2160D8",
          600: "#1A4FBE",
          700: "#153F98",
          800: "#123478",
          900: "#0E2758",
        },
        deep: {
          500: "#075BAA",
          600: "#064F96",
          700: "#054A86",
          900: "#043A61",
        },
        navy: {
          DEFAULT: "#17324D",
          700: "#1D3D5E",
          800: "#152B43",
          900: "#0F2338",
        },
        corporate: {
          red: "#E94343",
          yellow: "#F5B820",
        },
        // Semantic
        success: {
          DEFAULT: "#159B69",
          50: "#E9F7F1",
          100: "#CFEEDF",
        },
        warning: {
          DEFAULT: "#E6A817",
          50: "#FDF6E7",
          100: "#F9EAC2",
        },
        danger: {
          DEFAULT: "#D83B42",
          50: "#FBEAEB",
          100: "#F5CFD1",
        },
        risk: {
          low: "#159B69",
          medium: "#E6A817",
          high: "#E94343",
          "very-high": "#B3242B",
        },
        // Surface
        page: "#F4F6F9",
        border: "#E2E8F0",
        content: {
          primary: "#243447",
          secondary: "#64748B",
          muted: "#94A3B8",
        },
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(23, 50, 77, 0.06)",
        dropdown: "0 4px 12px rgba(23, 50, 77, 0.12)",
      },
      borderRadius: {
        card: "0.375rem",
      },
      keyframes: {
        "slide-in": {
          from: { transform: "translateY(-8px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        fade: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { transform: "scale(0.97)", opacity: "0" },
          to: { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "slide-in": "slide-in 0.2s ease-out",
        fade: "fade 0.15s ease-out",
        "scale-in": "scale-in 0.15s ease-out",
      },
    },
  },
  plugins: [],
};
