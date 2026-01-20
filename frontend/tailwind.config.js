/******** Tailwind CSS config (Next 12) ********/
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        dark: { 
          "primary": "#10b981", // Emerald 500 - Bright, readable green against dark
          "secondary": "#18181b", // Zinc 900
          "accent": "#34d399", // Emerald 400
          "neutral": "#09090b", // Zinc 950
          "base-100": "#09090b", // Zinc 950 - Deepest black-gray
          "base-200": "#18181b", // Zinc 900 - Slightly lighter for cards
          "base-300": "#27272a", // Zinc 800 - Borders/Separators
          "base-content": "#e4e4e7", // Zinc 200 - High legibility off-white
          "info": "#38bdf8",
          "success": "#34d399",
          "warning": "#f59e0b",
          "error": "#ef4444",
        },
      },
      {
        light: { 
          "primary": "#059669", // Emerald 600 - Professional Green
          "primary-content": "#ffffff",
          "secondary": "#f5f5f4", // Stone 100
          "accent": "#10b981", // Emerald 500
          "neutral": "#44403c", // Stone 700
          "base-100": "#fafaf9", // Stone 50 - Warm paper white
          "base-200": "#f5f5f4", // Stone 100
          "base-300": "#e7e5e4", // Stone 200
          "base-content": "#1c1917", // Stone 900
          "info": "#0ea5e9",
          "success": "#22c55e",
          "warning": "#eab308",
          "error": "#ef4444",
        },
      },
    ],
    darkTheme: "dark",
  },
};
