/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Warm Room design tokens
        oat:    "#EDE7DC",   // main background
        cream:  "#F7F3EA",   // panel / card surfaces
        ink:    "#2B2620",   // primary text
        forest: "#3F5D45",   // primary accent — buttons, focus rings, selected states
        ochre:  "#B8823D",   // warnings
        rust:   "#A5473A",   // errors
        sage:   "#6B8F71",   // online/success status — warm green, distinct from forest
      },
      fontFamily: {
        serif: ["Lora", "Georgia", "serif"],
        sans:  ["Public Sans", "system-ui", "sans-serif"],
      },
      animation: {
        border: "border 4s linear infinite",
      },
      keyframes: {
        border: {
          to: { "--border-angle": "360deg" },
        },
      },
    },
  },
  plugins: [],
};