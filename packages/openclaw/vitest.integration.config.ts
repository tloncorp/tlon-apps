import { config } from 'dotenv';
import { configDefaults, defineConfig } from 'vitest/config';

// The shared E2E runner supplies a scrubbed, explicit environment. Keep the
// legacy package-local shell runner behavior, but do not let local .env values
// leak back into shared-runtime OpenClaw runs.
if (process.env.TLON_BOT_E2E_DRIVER !== 'openclaw') {
  config();
}

// Integration suite config: test/cases/* prompt a live bot against ephemeral
// fakezod ships (see test/run.sh), so timeouts are generous and files run
// sequentially to avoid overlapping DM prompts.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 180_000,
    hookTimeout: 180_000,
    sequence: { shuffle: false },
    pool: 'forks',
    fileParallelism: false,
    exclude: [...configDefaults.exclude, '**/.pnpm-store/**'],
  },
});
