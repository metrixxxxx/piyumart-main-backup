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
      },
    },
  },
  plugins: [],
};