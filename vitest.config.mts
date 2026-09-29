import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // "server-only" faqat React Server muhitida ishlaydi — testlarda bo'sh modul
      "server-only": fileURLToPath(new URL("./tests/helpers/empty.ts", import.meta.url)),
    },
  },
  // PGlite testlari og'ir (har birida barcha migratsiyalar) — parallel ishlaganda 5 s yetmaydi
  test: { environment: "node", include: ["tests/**/*.test.ts"], testTimeout: 30_000 },
});
