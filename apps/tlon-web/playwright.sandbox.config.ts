import { defineConfig, devices } from '@playwright/test';

/**
 * Standalone browser-level tests for the surface sandbox posture: no
 * ships, no web servers — pages are constructed directly from the real
 * shell artifact and the host's document assembly, so this runs anywhere
 * (`pnpm e2e:sandbox`) after `pnpm build:surface-shell`.
 *
 * Engine selection. Sandbox containment that holds in one engine and
 * leaks in another is worthless, so the suite is runnable on all three
 * Playwright engines. `SANDBOX_ENGINES` picks which:
 *
 *   pnpm e2e:sandbox                              # chromium (default)
 *   SANDBOX_ENGINES=all pnpm e2e:sandbox          # chromium+firefox+webkit
 *   SANDBOX_ENGINES=firefox,webkit pnpm e2e:sandbox
 *
 * The default stays chromium-only so the existing entry point keeps its
 * runtime; CI or a posture review runs `SANDBOX_ENGINES=all`. Firefox and
 * WebKit need their binaries: `npx playwright install firefox webkit`.
 */
const ENGINES = {
  chromium: devices['Desktop Chrome'],
  firefox: devices['Desktop Firefox'],
  webkit: devices['Desktop Safari'],
} as const;

type EngineName = keyof typeof ENGINES;

const requested = (process.env.SANDBOX_ENGINES ?? 'chromium').trim();
const selected = (
  requested.toLowerCase() === 'all'
    ? (Object.keys(ENGINES) as EngineName[])
    : requested.split(',').map((name) => name.trim().toLowerCase())
) as EngineName[];

for (const name of selected) {
  if (!(name in ENGINES)) {
    throw new Error(
      `SANDBOX_ENGINES: unknown engine "${name}" (expected chromium, firefox, webkit, or all)`
    );
  }
}

export default defineConfig({
  testDir: './sandbox-posture',
  timeout: 60 * 1000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  projects: selected.map((name) => ({
    name,
    use: { ...ENGINES[name] },
  })),
});
