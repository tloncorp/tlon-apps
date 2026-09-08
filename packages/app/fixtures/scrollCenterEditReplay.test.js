import { it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

it('runs the independent center-edit and full-suite import fault controls', () => {
  const output = execFileSync(
    process.execPath,
    [
      '--experimental-strip-types',
      '--test',
      '--test-reporter=tap',
      'scripts/scroll-stability-center-edit-evidence.controls.mjs',
    ],
    {
      cwd: fileURLToPath(new URL('../../../', import.meta.url)),
      env: { ...process.env, NODE_OPTIONS: '' },
      encoding: 'utf8',
      timeout: 15000,
    }
  );
  expect(output).toMatch(/# fail 0\b/);
  expect(Number(output.match(/# tests (\d+)/)?.[1])).toBeGreaterThan(0);
});
