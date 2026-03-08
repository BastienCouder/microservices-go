import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  publicDir: "src/public",
  plugins: [tailwindcss(), react(), tsconfigPaths()],
  server: { port: 5173, strictPort: true },
});
