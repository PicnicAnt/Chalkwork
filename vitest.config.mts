import path from "node:path";
import { defineConfig } from "vitest/config";

// Tests live in tests/ and run with `npm test`. The "@" alias is the same as in the app.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: { include: ["tests/**/*.test.ts"] },
});
