import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { nitroV2Plugin } from "@tanstack/nitro-v2-vite-plugin";

// Virtual plugin to handle use-sync-external-store shim for React 19
const useSyncExternalStoreShimPlugin = {
  name: "use-sync-external-store-shim",
  enforce: "pre", // Run before other plugins
  resolveId(id) {
    if (
      id === "use-sync-external-store/shim/index.js" ||
      id === "use-sync-external-store/shim" ||
      id.startsWith("use-sync-external-store/shim/")
    ) {
      return "\0use-sync-external-store-shim";
    }
    return null;
  },
  load(id) {
    if (id === "\0use-sync-external-store-shim") {
      // Re-export React 19's built-in useSyncExternalStore
      return 'export { useSyncExternalStore } from "react";';
    }
    return null;
  },
};

const config = defineConfig({
  plugins: [
    // Handle use-sync-external-store shim first (before other plugins)
    useSyncExternalStoreShimPlugin,
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    tanstackStart(),
    nitroV2Plugin({
      preset: "node-server",
      serveStatic: true,
    }),
    viteReact(),
  ],
  optimizeDeps: {
    include: ["react", "react-dom"],
  },
});

export default config;
