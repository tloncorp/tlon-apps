// tests/main.test.ts
import { describe, expect, it } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

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
  it('prints help on --help', () => {
    const r = run('--help');
    expect(r.code).toBe(0);
    expect(r.out).toContain('Usage: tlon-memory');
  });
  it('prints help on unknown command', () => {
    const r = run('nope');
    expect(r.code).toBe(2);
    expect(r.err).toContain('Usage: tlon-memory');
  });
});

describe('usage and build', () => {
  it('USAGE lists every flag', async () => {
    const { USAGE } = await import('../src/main');
    for (const f of ['--ship-url', '--api-key-stdin', '--code-stdin', '--new-account', '--reconnect', '--notebook', '--scope', '--force-scope',
      '--yes', '--no-tool-io', '--out', '--session', '--memory', '--all', '--revoke-key']) expect(USAGE).toContain(f);
    expect(USAGE).not.toContain('--clients');
  });
  it('the build writes a bundle that runs under node alone', () => {
    const node = Bun.which('node');
    if (!node) return;
    expect(spawnSync(node, [join(root, 'scripts', 'build.js')], { encoding: 'utf8' }).status).toBe(0);
    const env = { HOME: process.env.HOME, PATH: dirname(node) };
    const v = spawnSync(node, [join(root, 'dist', 'tlon-memory.js'), '--version'], { encoding: 'utf8', env });
    expect(v.stdout).toMatch(/^tlon-memory \d+\.\d+\.\d+\n$/);
    const h = spawnSync(node, [join(root, 'dist', 'tlon-memory.js'), '--help'], { encoding: 'utf8', env });
    expect(h.status).toBe(0);
    expect(h.stdout).toContain('Usage: tlon-memory');
  });
});

describe('bin shim', () => {
  const node = Bun.which('node');
  /** A copy of the shim in a package layout holding only the given dist files. */
  function layout(files: Record<string, string>) {
    const dir = mkdtempSync(join(tmpdir(), 'tlm-shim-'));
    mkdirSync(join(dir, 'bin')); mkdirSync(join(dir, 'dist'));
    copyFileSync(join(root, 'bin', 'tlon-memory.js'), join(dir, 'bin', 'tlon-memory.js'));
    for (const [f, text] of Object.entries(files)) writeFileSync(join(dir, f), text, { mode: 0o755 });
    return join(dir, 'bin', 'tlon-memory.js');
  }
  const run = (shim: string, path: string) => spawnSync(node!, [shim, 'a', 'b'], { encoding: 'utf8', env: { HOME: process.env.HOME, PATH: path } });

  it('prefers the node bundle under the running node', () => {
    if (!node) return;
    const shim = layout({ 'dist/tlon-memory.js': 'console.log("bundle", process.execPath, process.argv.slice(2).join(","), process.env.TLON_MEMORY_CLI)',
      'dist/tlon-memory': '#!/bin/sh\necho binary' });
    const r = run(shim, '/nonexistent');
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe(`bundle ${realpathSync(node)} a,b ${realpathSync(shim)}`);
  });
  it('falls back to the compiled binary', () => {
    if (!node) return;
    const r = run(layout({ 'dist/tlon-memory': '#!/bin/sh\necho binary "$@"' }), '/bin');
    expect(r.stdout.trim()).toBe('binary a b');
  });
  it('falls back to bun on source and explains a minimal PATH', () => {
    if (!node) return;
    const r = run(layout({}), '/nonexistent');
    // bun is found through a fallback location (and fails on the missing source), or the message names the fix.
    if (r.status === 127) { expect(r.stderr).toContain('minimal PATH'); expect(r.stderr).toContain('pnpm build'); }
    else expect(r.stderr).toMatch(/main\.ts|not found|Module/i);
  });
});
