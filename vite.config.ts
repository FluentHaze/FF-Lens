import { defineConfig } from "vite";
export default defineConfig({
  build: {
    rollupOptions: {
      input: { panel: "index.html", background: "src/background.ts" },
      output: { entryFileNames: "[name].js" },
    },
  },
});
