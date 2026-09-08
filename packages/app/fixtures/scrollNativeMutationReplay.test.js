import { it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

it('independently validates native mutation raw geometry and corruptions with the real Node importer', () => {
  const output = execFileSync(
    process.execPath,
    [
      '--experimental-strip-types',
      'scripts/scroll-stability-native-mutation-controls.mjs',
    ],
    {
      cwd: fileURLToPath(new URL('../../../', import.meta.url)),
      env: { ...process.env, NODE_OPTIONS: '' },
      encoding: 'utf8',
      timeout: 15000,
    }
  );
  const report = JSON.parse(output);
  expect(
    report.failed,
    JSON.stringify(report.results.filter((result) => result.status === 'FAIL'))
  ).toBe(0);
  expect(report.passed).toBe(150);
});
