/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        pickle: {
          lime: '#C5EA4B',      // Signature Pickles.team neon electric lime
          limeHover: '#b4da36',
          limeMuted: 'rgba(197, 234, 75, 0.15)',
          dark: '#0C0C0C',      // Deep charcoal/black obsidian canvas
          card: '#141414',      // Card surface
          cardHover: '#1c1c1c',
          border: '#242424',
          subtle: '#888888',
          light: '#F9F9F9',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
