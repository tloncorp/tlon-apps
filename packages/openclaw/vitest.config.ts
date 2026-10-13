import { config } from 'dotenv';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configDefaults, defineConfig } from 'vitest/config';

// Load .env file
config();

// The 2026.9.x SDK's session-store code opens the OpenClaw state database on
// use; without this, unit tests would open (and possibly refuse, on a schema
// mismatch with a locally installed OpenClaw) the developer's real
// ~/.openclaw/state. Unit tests always get a throwaway state dir.
process.env.OPENCLAW_STATE_DIR = mkdtempSync(
  join(tmpdir(), 'openclaw-unit-state-')
);

// Unit tests only. The Docker-based integration suite under test/ runs via
// vitest.integration.config.ts; restricting include here keeps the monorepo's
// recursive test sweep (`pnpm run -r test`) from ever picking up test/cases.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    testTimeout: 180_000,
    hookTimeout: 180_000,
    sequence: { shuffle: false },
    pool: 'forks',
    fileParallelism: false,
    exclude: [...configDefaults.exclude, '**/.pnpm-store/**'],
  },
});
