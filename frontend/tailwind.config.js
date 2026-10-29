/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pickles: {
          bg: '#F4F4F0',          // Pale gray-whiteish canvas (Pickles.app)
          card: '#FFFFFF',        // Pure white card surfaces
          cardMuted: '#FAF9F6',   // Inset gray-white surface
          text: '#18181B',        // Anthracite dark text
          subtle: '#52525B',      // Muted anthracite secondary text
          border: '#D4D4D8',      // Crisp hairline borders
          borderDark: '#27272A',
          green: '#5F7A48',       // Refined muted pickle olive/sage (non-flashy)
          greenHover: '#4D643A',
          greenLight: '#EEF3E9',  // Subtle green tint background
          amber: '#B45309',       // Muted warm alert
          amberLight: '#FEF3C7',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      }
    },
  },
  plugins: [],
}
