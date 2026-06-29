import { defineConfig } from "vitest/config";

// Integration tests run against a throwaway local Postgres DB (school_test),
// routed through the multi-tenant stack via a test registry. The DB is shared
// across test files, so files run sequentially to avoid cross-test races.
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      TENANTS_FILE: "./tests/tenants.test.json",
    },
    include: ["tests/**/*.test.ts"],
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
