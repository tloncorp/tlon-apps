// tests/hook.test.ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { FakeNotes } from './fake-notes-server';
import { NotesClient } from '../src/notes-client';
import { Paths } from '../src/paths';
import { Config, defaultConfig, saveConfig } from '../src/config';
import { ensureNotebook } from '../src/notebook';

const fake = new FakeNotes(); let paths: Paths; let cfg: Config; let fx: string;
const main = join(import.meta.dir, '..', 'src', 'main.ts');
// Async spawn: spawnSync would block this process's event loop, so the in-process fake server could not answer the child.
async function hook(client: string, fixture: string, env: Record<string, string> = {}, edit = (s: string) => s) {
  const payload = edit(readFileSync(join(import.meta.dir, 'fixtures', fixture), 'utf8').replace('TRANSCRIPT', fx));
  const r = Bun.spawn(['bun', 'run', main, 'hook', client], { stdin: new TextEncoder().encode(payload), stdout: 'pipe', stderr: 'pipe', env: { ...process.env, TLON_MEMORY_HOME: paths.root, ...env } });
  const [out, err, code] = await Promise.all([new Response(r.stdout).text(), new Response(r.stderr).text(), r.exited]);
  return { code, out, err };
}
beforeAll(async () => { fake.start(); const c = new NotesClient({ shipUrl: fake.url, apiKey: 'test-key' });
  cfg = { ...defaultConfig(), shipUrl: fake.url, ship: '~zod', apiKey: 'test-key', scopes: ['/Users/bill/Projects/demo'], notebook: await ensureNotebook(c, 'Agent Memory') }; });
afterAll(() => fake.stop());
beforeEach(() => { paths = new Paths(mkdtempSync(join(tmpdir(), 'tm-hook-'))); saveConfig(paths, cfg);
  fx = join(paths.root, 't.jsonl'); copyFileSync(join(import.meta.dir, 'fixtures', 'claude-session.jsonl'), fx); fake.notes.clear(); });

describe('hook', () => {
  it('SessionStart prints one context line', async () => {
    const r = await hook('claude', 'hook-claude-start.json');
    expect(r.code).toBe(0);
    expect(r.out.split('\n').filter(Boolean).length).toBe(1);
    expect(r.out).toContain('Tlon memory: connected as ~zod');
    expect(r.out).toContain('capture ON');
    expect(r.out).toContain('0 pending');
    expect(r.out).toContain('session claude-code:11111111-aaaa-4bbb-8ccc-222222222222');
  });
  it('Stop uploads the conversation and prints nothing', async () => {
    const r = await hook('claude', 'hook-claude-stop.json');
    expect(r.code).toBe(0); expect(r.out).toBe('');
    expect(fake.notes.size).toBe(1);
    expect(readdirSync(paths.queueDir).length).toBe(0);
  });
  it('Codex Stop prints valid JSON or nothing', async () => {
    copyFileSync(join(import.meta.dir, 'fixtures', 'codex-rollout.jsonl'), fx);
    const r = await hook('codex', 'hook-codex-stop.json');
    expect(r.code).toBe(0); expect(r.out).toBe('');
    expect(fake.notes.size).toBe(1);
  });
  const sessionEnd = (s: string) => s.replace('"Stop"', '"SessionEnd"');
  it('SessionEnd after a synced Stop leaves no pending job', async () => {
    await hook('claude', 'hook-claude-stop.json');
    const r = await hook('claude', 'hook-claude-stop.json', {}, sessionEnd);
    expect(r.code).toBe(0); expect(r.out).toBe('');
    expect(fake.notes.size).toBe(1);
    expect(readdirSync(paths.queueDir).filter((f) => f.endsWith('.json')).length).toBe(0);
  });
  it('SessionEnd without a transcript file (e.g. `claude mcp list`) enqueues nothing', async () => {
    const r = await hook('claude', 'hook-claude-stop.json', {}, (s) => sessionEnd(s).replace(fx, join(paths.root, 'missing.jsonl')));
    expect(r.code).toBe(0);
    expect(readdirSync(paths.queueDir).length).toBe(0);
    expect(readFileSync(paths.logFile, 'utf8')).toContain('hook-no-transcript');
  });
  it('SessionEnd gives up after a short budget when the ship does not answer', async () => {
    const silent = Bun.serve({ port: 0, fetch: () => new Promise<Response>(() => {}) });
    try {
      saveConfig(paths, { ...cfg, shipUrl: `http://127.0.0.1:${silent.port}` });
      const t0 = Date.now();
      const r = await hook('claude', 'hook-claude-stop.json', {}, sessionEnd);
      expect(r.code).toBe(0);
      expect(Date.now() - t0).toBeLessThan(5_000);
      expect(readdirSync(paths.queueDir).filter((f) => f.endsWith('.json')).length).toBe(1); // left for the next Stop or sync
    } finally { silent.stop(true); }
  }, 20_000);
  it('out-of-scope cwd: nothing leaves the machine', () => {
    const payload = readFileSync(join(import.meta.dir, 'fixtures', 'hook-claude-stop.json'), 'utf8').replace('TRANSCRIPT', fx).replace('/Users/bill/Projects/demo', '/elsewhere');
    const before = fake.requests.length;
    const r = spawnSync('bun', ['run', main, 'hook', 'claude'], { input: payload, encoding: 'utf8', env: { ...process.env, TLON_MEMORY_HOME: paths.root } });
    expect(r.status).toBe(0); expect(fake.requests.length).toBe(before); expect(readdirSync(paths.queueDir).length).toBe(0);
  });
  it('paused: SessionStart says so and Stop uploads nothing', async () => {
    saveConfig(paths, { ...cfg, paused: true });
    expect((await hook('claude', 'hook-claude-start.json')).out).toContain('capture PAUSED');
    const before = fake.requests.length;
    await hook('claude', 'hook-claude-stop.json');
    expect(fake.requests.length).toBe(before);
  });
  it('corrupt config: exits 0 silently and logs', async () => {
    writeFileSync(paths.configFile, '{not json');
    const r = await hook('claude', 'hook-claude-stop.json');
    expect(r.code).toBe(0); expect(r.out).toBe('');
    expect(readFileSync(paths.logFile, 'utf8')).toContain('hook-config-unreadable');
  });
  it('not configured: exits 0 silently', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'tm-none-'));
    const r = await hook('claude', 'hook-claude-stop.json', { TLON_MEMORY_HOME: empty });
    expect(r.code).toBe(0); expect(r.out).toBe('');
  });
  it('key rejected: Stop keeps the job queued; next SessionStart reports it', async () => {
    saveConfig(paths, { ...cfg, apiKey: 'wrong' });
    const cfgBefore = readFileSync(paths.configFile, 'utf8');
    await hook('claude', 'hook-claude-stop.json');
    expect(readdirSync(paths.queueDir).filter((f) => f.endsWith('.json')).length).toBe(1);
    expect(readFileSync(paths.configFile, 'utf8')).toBe(cfgBefore); // the hook never rewrites config.json
    expect(JSON.parse(readFileSync(paths.connectionFile, 'utf8')).state).toBe('key-rejected');
    const r = await hook('claude', 'hook-claude-start.json');
    expect(r.out).toContain('KEY REJECTED');
    expect(r.out).toContain('1 pending');
  });
});

describe('hook helpers', () => {
  it('falls back to the default budget for a non-numeric TLON_MEMORY_SYNC_BUDGET_MS', async () => {
    const { budgetFromEnv, DEFAULT_BUDGET_MS } = await import('../src/hook');
    expect(budgetFromEnv('abc')).toBe(DEFAULT_BUDGET_MS);
    expect(budgetFromEnv('')).toBe(DEFAULT_BUDGET_MS);
    expect(budgetFromEnv(undefined)).toBe(DEFAULT_BUDGET_MS);
    expect(budgetFromEnv('2500')).toBe(2500);
  });
  it('connection defaults to ok when the file is absent', async () => {
    const { loadConnection } = await import('../src/status');
    expect(loadConnection(new Paths(mkdtempSync(join(tmpdir(), 'tm-conn-'))))).toEqual({ state: 'ok' });
  });
});
