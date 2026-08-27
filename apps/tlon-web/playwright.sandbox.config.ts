import { defineConfig, devices } from "@playwright/test";

/**
 * Standalone browser-level tests for the surface sandbox posture: no
 * ships, no web servers — pages are constructed directly from the real
 * shell artifact and the host's document assembly, so this runs anywhere
 * (`pnpm e2e:sandbox`) after `pnpm build:surface-shell`.
 */
export default defineConfig({
  testDir: "./sandbox-posture",
  timeout: 60 * 1000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
  },
});
