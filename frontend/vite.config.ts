import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The API runs on PLONGE_API (default http://localhost:8000); Vite proxies /api and /ws to it.
const api = process.env.PLONGE_API || "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: "0.0.0.0",
    proxy: {
      "/api": { target: api, changeOrigin: true },
      "/ws": { target: api.replace(/^http/, "ws"), ws: true },
    },
  },
});
