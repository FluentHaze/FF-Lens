import { defineConfig } from "vite";
export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: "src/content.ts",
      name: "FFLens",
      formats: ["iife"],
      fileName: () => "content.js",
    },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
