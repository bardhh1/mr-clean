import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      exclude: [
        "src/**/*.entity.ts",
        "src/database/migrations/**"
      ],
      thresholds: {
        branches: 75,
        functions: 80,
        lines: 80,
        statements: 80
      }
    },
    environment: "node",
    globals: true,
    include: ["src/**/*.spec.ts"],
    restoreMocks: true
  }
});
