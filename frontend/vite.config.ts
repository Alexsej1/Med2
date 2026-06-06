import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

/** Порт должен совпадать с uvicorn. На Windows часто 8000 занят — тогда 8001 и переменная ниже. */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = (env.VITE_API_TARGET || "http://127.0.0.1:8001").replace(/\/$/, "");

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": { target: apiTarget, changeOrigin: true },
        "/health": { target: apiTarget, changeOrigin: true },
      },
    },
  };
});
