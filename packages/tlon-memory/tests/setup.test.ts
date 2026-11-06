// tests/setup.test.ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { NotesClient } from '../src/notes-client';
import { ensureNotebook } from '../src/notebook';
import { FakeNotes } from './fake-notes-server';

const fake = new FakeNotes(); let home: string; let tmHome: string;
const root = join(import.meta.dir, '..');
const main = join(root, 'src', 'main.ts');
// Async spawn: spawnSync would block this process's event loop, so the in-process fake server could not answer the child.
async function run(args: string[], input = '', clis = ['claude', 'codex']) {
  // PATH shim: fake `claude`/`codex` binaries that record any call (setup should make none). PATH is only the shim dir plus the system
  // dirs, so a real `claude`/`codex` on this machine is never found.
  const bin = join(home, 'bin'); mkdirSync(bin, { recursive: true });
  for (const c of clis) { const f = join(bin, c); if (!existsSync(f)) { require('node:fs').writeFileSync(f, `#!/bin/sh\necho "$@" >> "${home}/${c}.calls"\n`, { mode: 0o755 }); } }
  const r = Bun.spawn(['bun', 'run', main, ...args], { stdin: new TextEncoder().encode(input), stdout: 'pipe', stderr: 'pipe', env: { ...process.env, HOME: home, TLON_MEMORY_HOME: tmHome, TLON_MEMORY_NO_BROWSER: '1', PATH: `${bin}:${dirname(process.execPath)}:/usr/bin:/bin` } });
  const [out, err, code] = await Promise.all([new Response(r.stdout).text(), new Response(r.stderr).text(), r.exited]);
  return { code, out, err };
}
beforeAll(() => fake.start()); afterAll(() => fake.stop());
beforeEach(() => { home = mkdtempSync(join(tmpdir(), 'tm-home-')); tmHome = join(home, '.tlon', 'memory'); fake.notes.clear(); fake.notebooks.clear(); fake.folders.clear(); fake.apiKey = 'test-key'; fake.failNextOn = null; });

describe('setup (non-interactive)', () => {
  it('connects with a pasted key, creates the notebook, probes, explains access, and prints the plugin installs', async () => {
    const r = await run(['setup', '--ship-url', fake.url, '--api-key-stdin', '--notebook', 'Agent Memory (test)', '--scope', '/Users/bill/Projects/demo', '--yes'], 'test-key\n');
    expect(r.code).toBe(0);
    expect(r.out).toContain('can read and write all Notes on your ship');
    expect(r.out).toContain('Connected as ~zod');
    expect(r.out).toContain('model provider');
    expect(r.out).toContain(`claude plugin install tlon-memory --marketplace ${root}`);
    expect(r.out).toContain(`codex plugin marketplace add ${root} && codex plugin add tlon-memory@tlon-memory`);
    expect(r.out).toContain('/hooks');
    const cfg = JSON.parse(readFileSync(join(tmHome, 'config.json'), 'utf8'));
    expect(statSync(join(tmHome, 'config.json')).mode & 0o777).toBe(0o600);
    expect(cfg.apiKey).toBe('test-key'); expect(cfg.ship).toBe('~zod'); expect(cfg.scopes).toEqual(['/Users/bill/Projects/demo']);
    expect(cfg.notebook.title).toBe('Agent Memory (test)'); expect(cfg.clients).toBeUndefined();
    // setup no longer touches the clients: neither CLI ran, nothing was written under their home dirs
    expect(existsSync(join(home, 'claude.calls'))).toBe(false); expect(existsSync(join(home, 'codex.calls'))).toBe(false);
    expect(existsSync(join(home, '.claude'))).toBe(false); expect(existsSync(join(home, '.codex'))).toBe(false);
    expect(fake.notes.size).toBe(0); // probe note is deleted after read-back
    expect(r.out).not.toContain('test-key');
  });
  it('exchanges +code for the key and stores only the key', async () => {
    const r = await run(['setup', '--ship-url', fake.url, '--code-stdin', '--notebook', 'AM', '--scope', '/p', '--yes'], `${fake.code}\n`);
    expect(r.code).toBe(0);
    const cfg = JSON.parse(readFileSync(join(tmHome, 'config.json'), 'utf8'));
    expect(cfg.apiKey).toBe(fake.apiKey);
    expect(JSON.stringify(cfg)).not.toContain(fake.code);
    expect(r.out).not.toContain(fake.code);
  });
  it('fails clearly on a rejected key without writing config', async () => {
    const r = await run(['setup', '--ship-url', fake.url, '--api-key-stdin', '--notebook', 'AM', '--scope', '/p', '--yes'], 'wrong\n');
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
    await run(['setup', '--ship-url', fake.url, '--api-key-stdin', '--notebook', 'AM', '--scope', '/p', '--yes'], 'test-key\n');
    fake.apiKey = 'rotated';
    const r = await run(['setup', '--reconnect', '--api-key-stdin', '--yes'], 'rotated\n');
    expect(r.code).toBe(0);
    const cfg = JSON.parse(readFileSync(join(tmHome, 'config.json'), 'utf8'));
    expect(cfg.apiKey).toBe('rotated'); expect(cfg.scopes).toEqual(['/p']); expect(cfg.connection).toBeUndefined();
    expect(JSON.parse(readFileSync(join(tmHome, 'state', 'connection.json'), 'utf8')).state).toBe('ok');
  });

  it('writes the .initialized marker only when it created the notebook', async () => {
    const marker = join(tmHome, 'state', '.initialized');
    await run(['setup', '--ship-url', fake.url, '--api-key-stdin', '--notebook', 'Fresh', '--scope', '/p', '--yes'], 'test-key\n');
    expect(Date.parse(readFileSync(marker, 'utf8').trim())).toBeGreaterThan(0);
    // a second device adopts the notebook the first one made: its state is empty, but the ship may hold its sessions
    home = mkdtempSync(join(tmpdir(), 'tm-home-')); tmHome = join(home, '.tlon', 'memory');
    const r = await run(['setup', '--ship-url', fake.url, '--api-key-stdin', '--notebook', 'Fresh', '--scope', '/p', '--yes'], 'test-key\n');
    expect(r.code).toBe(0);
    expect(existsSync(join(tmHome, 'state', '.initialized'))).toBe(false);
  });
  it('--reconnect clears the backoff of every queued job', async () => {
    await run(['setup', '--ship-url', fake.url, '--api-key-stdin', '--notebook', 'AM', '--scope', '/p', '--yes'], 'test-key\n');
    const q = join(tmHome, 'queue'); mkdirSync(q, { recursive: true });
    const job = { client: 'claude', sessionId: 's', transcriptPath: '/nope', cwd: '/p', enqueuedAt: new Date().toISOString(), attempts: 6, hardFailures: 2, nextAttemptAt: new Date(Date.now() + 3_600_000).toISOString() };
    writeFileSync(join(q, 'claude-s.json'), JSON.stringify(job));
    expect((await run(['setup', '--reconnect', '--api-key-stdin', '--yes'], 'test-key\n')).code).toBe(0);
    const after = JSON.parse(readFileSync(join(q, 'claude-s.json'), 'utf8'));
    expect(after.attempts).toBe(0); expect(after.hardFailures).toBe(0); expect(after.nextAttemptAt).toBeUndefined();
  });
  it('--reconnect accepts --ship-url to move to a new URL, and needs an existing setup', async () => {
    expect((await run(['setup', '--reconnect', '--api-key-stdin', '--yes'], 'test-key\n')).code).toBe(2);
    await run(['setup', '--ship-url', fake.url, '--api-key-stdin', '--notebook', 'AM', '--scope', '/p', '--yes'], 'test-key\n');
    const moved = fake.url.replace('127.0.0.1', 'localhost');
    const r = await run(['setup', '--reconnect', '--ship-url', moved, '--api-key-stdin', '--yes'], 'test-key\n');
    expect(r.code).toBe(0);
    expect(JSON.parse(readFileSync(join(tmHome, 'config.json'), 'utf8')).shipUrl).toBe(moved);
  });
  it('warns that a fresh setup over an existing one resets scopes', async () => {
    const base = ['setup', '--ship-url', fake.url, '--api-key-stdin', '--notebook', 'AM', '--yes'];
    await run([...base, '--scope', '/p'], 'test-key\n');
    const r = await run([...base, '--scope', '/q'], 'test-key\n');
    expect(r.code).toBe(0); expect(r.out).toContain('resets scopes');
  });
});

describe('setup input validation', () => {
  const ok = ['--api-key-stdin', '--notebook', 'AM'];
  it('--yes needs --ship-url, a credential flag and --scope', async () => {
    expect((await run(['setup', ...ok, '--scope', '/p', '--yes'], 'test-key\n')).code).toBe(2);
    expect((await run(['setup', '--ship-url', fake.url, ...ok, '--yes'], 'test-key\n')).code).toBe(2);
    const r = await run(['setup', '--ship-url', fake.url, '--notebook', 'AM', '--scope', '/p', '--yes']);
    expect(r.code).toBe(2); expect(r.err).toContain('--api-key-stdin');
    expect(existsSync(join(tmHome, 'config.json'))).toBe(false);
  });
  it('refuses home or / as scope unless --force-scope', async () => {
    const r = await run(['setup', '--ship-url', fake.url, ...ok, '--scope', home, '--yes'], 'test-key\n');
    expect(r.code).toBe(2); expect(r.err).toContain('--force-scope');
    expect((await run(['setup', '--ship-url', fake.url, ...ok, '--scope', '/', '--yes'], 'test-key\n')).code).toBe(2);
    expect((await run(['setup', '--ship-url', fake.url, ...ok, '--scope', home, '--force-scope', '--yes'], 'test-key\n')).code).toBe(0);
  });
  it('refuses an ancestor of home (like /Users) unless --force-scope', async () => {
    const parent = dirname(home);
    const r = await run(['setup', '--ship-url', fake.url, ...ok, '--scope', parent, '--yes'], 'test-key\n');
    expect(r.code).toBe(2); expect(r.err).toContain('--force-scope'); expect(r.err).toContain('home');
    expect((await run(['setup', '--ship-url', fake.url, ...ok, '--scope', join(home, 'proj'), '--yes'], 'test-key\n')).code).toBe(0);
    expect((await run(['setup', '--ship-url', fake.url, ...ok, '--scope', parent, '--force-scope', '--yes'], 'test-key\n')).code).toBe(0);
  });
  it('normalises a ship URL copied with a path, and rejects plain http to a remote host', async () => {
    const r = await run(['setup', '--ship-url', `${fake.url}/apps/groups/`, ...ok, '--scope', '/p', '--yes'], 'test-key\n');
    expect(r.code).toBe(0); expect(r.out).toContain(`Ship URL: ${fake.url}`);
    expect(JSON.parse(readFileSync(join(tmHome, 'config.json'), 'utf8')).shipUrl).toBe(fake.url);
    const bad = await run(['setup', '--ship-url', 'http://sampel-palnet.tlon.network', ...ok, '--scope', '/p', '--yes'], 'test-key\n');
    expect(bad.code).toBe(2); expect(bad.err).toContain('https');
  });
});

describe('setup plugin instructions', () => {
  const base = () => ['setup', '--ship-url', fake.url, '--api-key-stdin', '--notebook', 'AM', '--scope', '/p', '--yes'];
  it('prints the install only for a client on PATH', async () => {
    const r = await run(base(), 'test-key\n', ['claude']);
    expect(r.code).toBe(0); expect(r.out).toContain('claude plugin install'); expect(r.out).not.toContain('codex plugin');
    expect(r.out).not.toContain('/hooks');
  });
  it('prints both installs when neither client is on PATH', async () => {
    const r = await run(base(), 'test-key\n', []);
    expect(r.code).toBe(0); expect(r.out).toContain('Neither `claude` nor `codex` is on PATH');
    expect(r.out).toContain('claude plugin install'); expect(r.out).toContain('codex plugin add');
  });
  it('--reconnect does not repeat the install instructions', async () => {
    await run(base(), 'test-key\n');
    const r = await run(['setup', '--reconnect', '--api-key-stdin', '--yes'], 'test-key\n');
    expect(r.code).toBe(0); expect(r.out).not.toContain('plugin install');
  });
  it('a failed probe says setup was saved and exits 1', async () => {
    const nb = await ensureNotebook(new NotesClient({ shipUrl: fake.url, apiKey: 'test-key' }), 'AM');
    fake.failNextOn = { path: `/notes/~/v1/notebooks/${nb.host}/${nb.name}/search/bounded/text`, status: 500 };
    const r = await run(base(), 'test-key\n');
    expect(r.code).toBe(1); expect(r.err).toContain('setup saved; run `tlon-memory status`');
    expect(existsSync(join(tmHome, 'config.json'))).toBe(true);
  });
});

describe('normaliseShipUrl', () => {
  it('keeps the origin, allows http only for local hosts', async () => {
    const { normaliseShipUrl } = await import('../src/setup');
    expect(normaliseShipUrl('https://sampel-palnet.tlon.network/apps/groups/?x=1')).toBe('https://sampel-palnet.tlon.network');
    expect(normaliseShipUrl('http://[::1]:8080/')).toBe('http://[::1]:8080');
    expect(normaliseShipUrl('http://localhost:8080')).toBe('http://localhost:8080');
    expect(() => normaliseShipUrl('http://10.0.0.5')).toThrow('https://');
    expect(() => normaliseShipUrl('sampel-palnet.tlon.network')).toThrow('not a URL');
  });
});

describe('packageRoot', () => {
  it('uses the source tree when run from source, and the binary location inside a compiled binary', async () => {
    const { packageRoot } = await import('../src/setup');
    expect(packageRoot('/Users/x/.bun/bin/bun', 'file:///repo/packages/tlon-memory/src/setup.ts')).toBe('/repo/packages/tlon-memory');
    expect(packageRoot('/repo/packages/tlon-memory/dist/tlon-memory', 'file:///$bunfs/root/tlon-memory')).toBe('/repo/packages/tlon-memory');
    expect(packageRoot('/opt/tm/dist/tlon-memory', 'file:///somewhere/else.js')).toBe('/opt/tm'); // named binary, unusual url
  });
  it('PLUGIN_ROOT is this package when run from source', async () => {
    const { PLUGIN_ROOT } = await import('../src/setup');
    expect(PLUGIN_ROOT).toBe(root);
  });
});
