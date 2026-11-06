// tests/hook.test.ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { copyFileSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
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
async function hook(client: string, fixture: string, env: Record<string, string> = {}) {
  const payload = readFileSync(join(import.meta.dir, 'fixtures', fixture), 'utf8').replace('TRANSCRIPT', fx);
  const r = Bun.spawn(['bun', 'run', main, 'hook', client], { stdin: new TextEncoder().encode(payload), stdout: 'pipe', stderr: 'pipe', env: { ...process.env, TLON_MEMORY_HOME: paths.root, ...env } });
  const [out, err, code] = await Promise.all([new Response(r.stdout).text(), new Response(r.stderr).text(), r.exited]);
  return { code, out, err };
}
beforeAll(async () => { fake.start(); const c = new NotesClient({ shipUrl: fake.url, apiKey: 'test-key' });
  cfg = { ...defaultConfig(), shipUrl: fake.url, ship: '~zod', apiKey: 'test-key', scopes: ['/Users/bill/Projects/demo'], notebook: await ensureNotebook(c, 'Agent Memory'),
    clients: { claude: { mcp: true, hooks: true, skill: true, installedAt: '' }, codex: { mcp: true, hooks: true, skill: true, installedAt: '' } } }; });
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
  it('not configured: exits 0 silently', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'tm-none-'));
    const r = await hook('claude', 'hook-claude-stop.json', { TLON_MEMORY_HOME: empty });
    expect(r.code).toBe(0); expect(r.out).toBe('');
  });
  it('key rejected: Stop keeps the job queued; next SessionStart reports it', async () => {
    saveConfig(paths, { ...cfg, apiKey: 'wrong' });
    await hook('claude', 'hook-claude-stop.json');
    expect(readdirSync(paths.queueDir).length).toBe(1);
    const r = await hook('claude', 'hook-claude-start.json');
    expect(r.out).toContain('KEY REJECTED');
    expect(r.out).toContain('1 pending');
  });
});
