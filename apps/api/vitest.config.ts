import { existsSync } from "node:fs";
import { defineConfig } from "vitest/config";

if (existsSync("../../.env")) process.loadEnvFile("../../.env");

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    fileParallelism: false,
    env: { LOG_LEVEL: "silent" },
  },
});
