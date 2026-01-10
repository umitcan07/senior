import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { nitroV2Plugin } from "@tanstack/nitro-v2-vite-plugin";


const config = defineConfig({
  plugins: [
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
    // Fix for React 19: use-sync-external-store shim compatibility
    {
      name: "use-sync-external-store-shim",
      enforce: "pre",
      resolveId(id) {
        const cleanId = id.split("?")[0];
        if (
          cleanId === "use-sync-external-store/shim/index.js" ||
          cleanId === "use-sync-external-store/shim"
        ) {
          return "\0use-sync-external-store-shim";
        }
        return null;
      },
      load(id) {
        if (id === "\0use-sync-external-store-shim") {
          return 'export { useSyncExternalStore } from "react";';
        }
        return null;
      },
    },
  ],
});

export default config;
