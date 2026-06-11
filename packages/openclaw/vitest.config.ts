import { defineConfig, configDefaults } from "vitest/config";
import { config } from "dotenv";

// Load .env file
config();

export default defineConfig({
  test: {
    // Increase timeout for integration tests (they hit real services)
    testTimeout: 180_000,
    hookTimeout: 180_000,
    // Run tests sequentially (not in parallel)
    sequence: { shuffle: false },
    pool: "forks",
    fileParallelism: false,
    exclude: [...configDefaults.exclude, "**/.pnpm-store/**"],
  },
});
