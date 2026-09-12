import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { resolveSupabaseConfig } from "./src/lib/appConfig";

export default defineConfig(({ mode }) => {
  // Fail before generating a production bundle with a missing or mismatched key.
  if (mode === "production") {
    resolveSupabaseConfig(loadEnv(mode, process.cwd(), "VITE_"));
  }
  // Vite exposes public vars to the browser but does not populate process.env for server middleware.
  // Keep private runtime configuration on the server; envPrefix below remains public-only.
  for (const [name, value] of Object.entries(loadEnv(mode, process.cwd(), ""))) {
    process.env[name] ??= value;
  }

  return ({
  // Expose both VITE_ and NEXT_PUBLIC_ prefixed vars to the client bundle.
  // The Supabase integration provides NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.
  // Only PUBLIC keys are ever exposed this way — never service-role secrets.
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  server: {
    host: "0.0.0.0",
    port: Number(process.env.PORT || process.env.DEV_PORT || 3000),
    allowedHosts: true as const,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  });
});
