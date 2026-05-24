// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./pages/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // LSPU Navy Blue
        lspu: {
          navy:        "#1a2a6c",
          "navy-dark": "#142060",
          "navy-light":"#2a3f9c",
        },
        // LSPU Green
        lspugreen: {
          DEFAULT: "#1a6c2a",
          dark:    "#145520",
          light:   "#1e7a32",
        },
        // LSPU Gold
        lspugold: {
          DEFAULT: "#c9a028",
          dark:    "#b08a1a",
          light:   "#d4aa40",
        },
        // PiyuMart Login UI
        pm: {
          bg:         "#0e1140",
          left:       "#151a4e",
          right:      "#1a1f5e",
          card:       "#1c2260",
          border:     "#2a3272",
          muted:      "#6b73b0",
          text:       "#e8ecff",
          gold:       "#c9922a",
          "gold-hover": "#b5821f",
        },
      },
    },
  },
  plugins: [require("tailwind-scrollbar")],
};