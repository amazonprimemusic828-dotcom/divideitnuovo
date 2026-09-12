import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { ORIGINAL_SUPABASE_URL, SUPABASE_PROJECT_REF } from "./src/lib/appConfig";

// Unit tests never depend on production credentials. This unsigned fixture is
// used only by tests; Supabase will not accept it for real API requests.
const testAnonKey = `test.${Buffer.from(JSON.stringify({
  ref: SUPABASE_PROJECT_REF, role: "anon",
})).toString("base64url")}.test`;

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    env: {
      VITE_SUPABASE_URL: ORIGINAL_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: testAnonKey,
    },
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
