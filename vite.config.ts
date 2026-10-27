import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pages(/connectium-overtime-calculator/ 하위 경로)와 로컬 모두에서 동작하도록 상대 경로
  base: "./",
  plugins: [react()],
});
