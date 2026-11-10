import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  base: "/",
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: { react: ["react", "react-dom/client"] },
      },
    },
  },
  server: {
    proxy: {
      "/scheduler": "http://127.0.0.1:8000",
      "/booking": "http://127.0.0.1:8000",
      "/guest": "http://127.0.0.1:8000",
      "/status": "http://127.0.0.1:8000",
      "/auth": "http://127.0.0.1:8000",
      "/user": "http://127.0.0.1:8000",
      "/contacts": "http://127.0.0.1:8000",
      "/appointments": "http://127.0.0.1:8000",
    },
  },
  preview: {
    proxy: {
      "/scheduler": "http://127.0.0.1:8000",
      "/booking": "http://127.0.0.1:8000",
      "/guest": "http://127.0.0.1:8000",
      "/status": "http://127.0.0.1:8000",
      "/auth": "http://127.0.0.1:8000",
      "/user": "http://127.0.0.1:8000",
      "/contacts": "http://127.0.0.1:8000",
      "/appointments": "http://127.0.0.1:8000",
    },
  },
});
