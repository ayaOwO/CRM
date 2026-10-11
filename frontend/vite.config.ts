import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    proxy: {
      "/contacts": "http://127.0.0.1:8000",
      "/appointments": "http://127.0.0.1:8000",
    },
  },
  preview: {
    proxy: {
      "/contacts": "http://127.0.0.1:8000",
      "/appointments": "http://127.0.0.1:8000",
    },
  },
});
