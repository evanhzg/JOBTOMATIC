/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#231f20",
        navy: "#26498d",
        paper: "#f3f1ec",
        cream: "#fffcf9",
        muted: "#6b6566",
        rule: "#231f20",
        wash: "#e6ebf4",
        alert: "#a3341f",
      },
      fontFamily: {
        display: ['"Spectral"', "Georgia", "serif"],
        mono: ['"Space Mono"', "ui-monospace", "monospace"],
        body: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
