// tests/main.test.ts
import { describe, expect, it } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const root = join(import.meta.dir, '..');
function run(...args: string[]) {
  const r = spawnSync('bun', ['run', join(root, 'src/main.ts'), ...args], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

describe('cli', () => {
  it('prints version', () => {
    const r = run('--version');
    expect(r.code).toBe(0);
    expect(r.out.trim()).toMatch(/^tlon-memory \d+\.\d+\.\d+/);
  });
  it('prints help on unknown command', () => {
    const r = run('nope');
    expect(r.code).toBe(2);
    expect(r.err).toContain('Usage: tlon-memory');
  });
});
