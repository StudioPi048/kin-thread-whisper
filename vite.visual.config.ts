import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { fileURLToPath } from "node:url";
// Isolated local fixture preview. The production configuration never imports this file.
export default defineConfig({
  tanstackStart: { server: { entry: "server" } },
  vite: {
    optimizeDeps: {
      include: [
        "react",
        "react-dom/client",
        "react/jsx-runtime",
        "@tanstack/react-router",
        "@tanstack/react-query",
      ],
    },
    plugins: [
      {
        name: "genealiz-local-fixtures",
        enforce: "pre",
        configResolved(config) {
          if (config.command !== "serve")
            throw new Error("Fixture preview cannot be built or published.");
        },
        resolveId(id) {
          if (
            id === "@/integrations/lovable/index" ||
            /\/integrations\/lovable\/index(?:\.ts)?$/.test(id)
          )
            return fileURLToPath(new URL("./design/preview/lovable.ts", import.meta.url));
          if (
            id === "@/integrations/supabase/client" ||
            /\/integrations\/supabase\/client(?:\.ts)?$/.test(id)
          )
            return fileURLToPath(new URL("./design/preview/client.ts", import.meta.url));
          if (
            [
              "@/lib/agenda.functions",
              "@/lib/genogram.functions",
              "@/lib/ai/session-processing.functions",
            ].some((path) => id.replace(/\.ts$/, "").endsWith(path.slice(1)))
          )
            return fileURLToPath(new URL("./design/preview/functions.ts", import.meta.url));
        },
      },
    ],
  },
});
