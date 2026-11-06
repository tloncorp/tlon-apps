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

describe('usage and bin shim', () => {
  it('USAGE lists every flag', async () => {
    const { USAGE } = await import('../src/main');
    for (const f of ['--ship-url', '--api-key-stdin', '--code-stdin', '--new-account', '--reconnect', '--notebook', '--scope', '--force-scope',
      '--clients', '--yes', '--no-tool-io', '--out', '--session', '--memory', '--all', '--revoke-key']) expect(USAGE).toContain(f);
  });
  it('the shim falls back to known bun locations and explains a minimal PATH', () => {
    const shim = join(root, 'bin', 'tlon-memory.js');
    // PATH holds only node's directory: bun is found through a fallback location, or the message names the fix.
    const node = Bun.which('node');
    if (!node) return; // the shim runs under node; nothing to check without it
    const r = spawnSync(node, [shim, '--version'], { encoding: 'utf8', env: { HOME: process.env.HOME, PATH: '/nonexistent' } });
    if (r.status === 0) expect(r.stdout).toMatch(/^tlon-memory /);
    else { expect(r.status).toBe(127); expect(r.stderr).toContain('minimal PATH'); expect(r.stderr).toContain('pnpm build'); }
  });
});
