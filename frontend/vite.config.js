import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const buildVersion = process.env.VITE_APP_VERSION || `${Date.now()}`;

function appVersionPlugin() {
  return {
    name: "rve-app-version",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify(
          {
            version: buildVersion,
            builtAt: new Date().toISOString(),
          },
          null,
          2
        ),
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true,
    port: 5173,
    
  },
  plugins: [react(), appVersionPlugin()],
});
