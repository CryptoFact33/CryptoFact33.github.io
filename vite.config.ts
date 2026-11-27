import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    target: "es2023",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          wagmi: ["wagmi", "@tanstack/react-query"],
          viem: ["viem"],
          appkit: ["@reown/appkit", "@reown/appkit-adapter-wagmi"],
        },
      },
    },
  },
});
