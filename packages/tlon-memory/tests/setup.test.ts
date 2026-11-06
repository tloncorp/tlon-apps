// tests/setup.test.ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FakeNotes } from './fake-notes-server';

const fake = new FakeNotes(); let home: string; let tmHome: string;
const main = join(import.meta.dir, '..', 'src', 'main.ts');
// Async spawn: spawnSync would block this process's event loop, so the in-process fake server could not answer the child.
async function run(args: string[], input = '') {
  // PATH shim: fake `claude`/`codex` binaries that record their args
  const bin = join(home, 'bin'); mkdirSync(bin, { recursive: true });
  for (const c of ['claude', 'codex']) { const f = join(bin, c); if (!existsSync(f)) { require('node:fs').writeFileSync(f, `#!/bin/sh\necho "$@" >> "${home}/${c}.calls"\n`, { mode: 0o755 }); } }
  const r = Bun.spawn(['bun', 'run', main, ...args], { stdin: new TextEncoder().encode(input), stdout: 'pipe', stderr: 'pipe', env: { ...process.env, HOME: home, TLON_MEMORY_HOME: tmHome, TLON_MEMORY_NO_BROWSER: '1', PATH: `${bin}:${process.env.PATH}` } });
  const [out, err, code] = await Promise.all([new Response(r.stdout).text(), new Response(r.stderr).text(), r.exited]);
  return { code, out, err };
}
beforeAll(() => fake.start()); afterAll(() => fake.stop());
beforeEach(() => { home = mkdtempSync(join(tmpdir(), 'tm-home-')); tmHome = join(home, '.tlon', 'memory'); fake.notes.clear(); fake.notebooks.clear(); fake.folders.clear(); });

describe('setup (non-interactive)', () => {
  it('connects with a pasted key, creates the notebook, configures both clients, probes, and explains access', async () => {
    const r = await run(['setup', '--ship-url', fake.url, '--api-key-stdin', '--notebook', 'Agent Memory (test)', '--scope', '/Users/bill/Projects/demo', '--clients', 'claude,codex', '--yes'], 'test-key\n');
    expect(r.code).toBe(0);
    expect(r.out).toContain('can read and write all Notes on your ship');
    expect(r.out).toContain('Connected as ~zod');
    expect(r.out).toContain('model provider');
    expect(r.out).toContain('Codex: run /hooks');
    const cfg = JSON.parse(readFileSync(join(tmHome, 'config.json'), 'utf8'));
    expect(statSync(join(tmHome, 'config.json')).mode & 0o777).toBe(0o600);
    expect(cfg.apiKey).toBe('test-key'); expect(cfg.ship).toBe('~zod'); expect(cfg.scopes).toEqual(['/Users/bill/Projects/demo']);
    expect(cfg.notebook.title).toBe('Agent Memory (test)'); expect(cfg.clients.claude.mcp).toBe(true); expect(cfg.clients.codex.hooks).toBe(true);
    expect(readFileSync(join(home, 'claude.calls'), 'utf8')).toContain('mcp add -s user');
    expect(readFileSync(join(home, 'codex.calls'), 'utf8')).toContain('mcp add');
    expect(fake.notes.size).toBe(0); // probe note is deleted after read-back
    expect(r.out).not.toContain('test-key');
  });
  it('exchanges +code for the key and stores only the key', async () => {
    const r = await run(['setup', '--ship-url', fake.url, '--code-stdin', '--notebook', 'AM', '--scope', '/p', '--clients', 'none', '--yes'], `${fake.code}\n`);
    expect(r.code).toBe(0);
    const cfg = JSON.parse(readFileSync(join(tmHome, 'config.json'), 'utf8'));
    expect(cfg.apiKey).toBe(fake.apiKey);
    expect(JSON.stringify(cfg)).not.toContain(fake.code);
    expect(r.out).not.toContain(fake.code);
  });
  it('fails clearly on a rejected key without writing config', async () => {
    const r = await run(['setup', '--ship-url', fake.url, '--api-key-stdin', '--notebook', 'AM', '--scope', '/p', '--clients', 'none', '--yes'], 'wrong\n');
    expect(r.code).toBe(1);
    expect(r.err).toContain('rejected the API key');
    expect(existsSync(join(tmHome, 'config.json'))).toBe(false);
  });
  it('--new-account prints the signup URL and exits 0 without connecting', async () => {
    const r = await run(['setup', '--new-account', '--yes']);
    expect(r.code).toBe(0);
    expect(r.out).toContain('https://tlon.network/signup?source=agent');
    expect(r.out).toContain('re-run `tlon-memory setup`');
  });
  it('--reconnect keeps notebook/scope and replaces the key', async () => {
    await run(['setup', '--ship-url', fake.url, '--api-key-stdin', '--notebook', 'AM', '--scope', '/p', '--clients', 'none', '--yes'], 'test-key\n');
    fake.apiKey = 'rotated';
    const r = await run(['setup', '--reconnect', '--api-key-stdin', '--yes'], 'rotated\n');
    expect(r.code).toBe(0);
    const cfg = JSON.parse(readFileSync(join(tmHome, 'config.json'), 'utf8'));
    expect(cfg.apiKey).toBe('rotated'); expect(cfg.scopes).toEqual(['/p']); expect(cfg.connection.state).toBe('ok');
  });
});
