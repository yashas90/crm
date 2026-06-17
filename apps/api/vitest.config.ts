import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    testTimeout: 30_000,
    setupFiles: ["./src/test/setup.ts"],
    env: {
      AUTH_JWT_SECRET: "vitest-jwt-secret-min-16-chars",
    },
  },
});
