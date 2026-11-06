// tests/commands.test.ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FakeNotes } from './fake-notes-server';
import { NotesClient } from '../src/notes-client';
import { Paths } from '../src/paths';
import { Config, defaultConfig, saveConfig, loadConfig } from '../src/config';
import { ensureNotebook } from '../src/notebook';
import { MemoryStore } from '../src/memory';
import { enqueue, syncQueue } from '../src/sync';

const fake = new FakeNotes(); let paths: Paths; let cfg: Config;
const main = join(import.meta.dir, '..', 'src', 'main.ts');
// Async spawn: spawnSync would block this process's event loop, so the in-process fake server could not answer the child.
// HOME also points at the temp dir so `disconnect` never touches the real ~/.claude or ~/.codex.
const run = async (...args: string[]) => { const r = Bun.spawn(['bun', 'run', main, ...args], { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', env: { ...process.env, HOME: paths.root, TLON_MEMORY_HOME: paths.root, PATH: `${paths.root}/bin:${process.env.PATH}` } });
  const [out, err, code] = await Promise.all([new Response(r.stdout).text(), new Response(r.stderr).text(), r.exited]); return { code, out, err }; };
beforeAll(async () => { fake.start(); const c = new NotesClient({ shipUrl: fake.url, apiKey: 'test-key' });
  cfg = { ...defaultConfig(), shipUrl: fake.url, ship: '~zod', apiKey: 'test-key', scopes: ['/Users/bill/Projects/demo'], notebook: await ensureNotebook(c, 'Agent Memory') }; });
afterAll(() => fake.stop());
beforeEach(async () => { paths = new Paths(mkdtempSync(join(tmpdir(), 'tm-cmd-'))); saveConfig(paths, cfg); fake.notes.clear();
  const fx = join(paths.root, 't.jsonl'); copyFileSync(join(import.meta.dir, 'fixtures', 'claude-session.jsonl'), fx);
  enqueue(paths, { client: 'claude', sessionId: 's', transcriptPath: fx, cwd: '/Users/bill/Projects/demo' }); await syncQueue(paths, cfg, { budgetMs: 10_000 });
  await new MemoryStore(paths, cfg).save({ type: 'decision', text: 'Use SQLite.', agent: 'claude-code', project: 'demo', sessionKey: 'claude-code:11111111-aaaa-4bbb-8ccc-222222222222', event: 'e2' }); });

describe('commands', () => {
  it('status shows connection, scope, counts', async () => {
    const r = await run('status'); expect(r.code).toBe(0);
    expect(r.out).toContain('~zod'); expect(r.out).toContain('/Users/bill/Projects/demo'); expect(r.out).toContain('conversations: 1'); expect(r.out).toContain('memories: 1'); expect(r.out).not.toContain('test-key');
  });
  it('pause/resume toggle and scope add/remove/list', async () => {
    expect((await run('pause')).out).toContain('paused'); expect(loadConfig(paths)!.paused).toBe(true);
    expect((await run('resume')).out).toContain('resumed'); expect(loadConfig(paths)!.paused).toBe(false);
    await run('scope', 'add', '/tmp/x'); expect(loadConfig(paths)!.scopes).toContain('/tmp/x');
    expect((await run('scope', 'list')).out).toContain('/tmp/x');
    await run('scope', 'remove', '/tmp/x'); expect(loadConfig(paths)!.scopes).not.toContain('/tmp/x');
  });
  it('export writes markdown + index without the key', async () => {
    const out = join(paths.root, 'export'); const r = await run('export', '--out', out); expect(r.code).toBe(0);
    expect(readdirSync(join(out, 'conversations')).length).toBe(1); expect(readdirSync(join(out, 'memories')).length).toBe(1);
    const idx = JSON.parse(readFileSync(join(out, 'index.json'), 'utf8')); expect(idx.notes.length).toBe(2); expect(JSON.stringify(idx)).not.toContain('test-key');
  });
  it('delete --session removes the conversation note and local state; --memory removes a memory; --all empties both folders', async () => {
    expect((await run('delete', '--session', 'claude-code:11111111-aaaa-4bbb-8ccc-222222222222', '--yes')).code).toBe(0);
    expect([...fake.notes.values()].filter((n) => n.folderId === cfg.notebook!.conversationsFolderId).length).toBe(0);
    expect(readdirSync(paths.stateDir).length).toBe(0);
    const mem = [...fake.notes.values()][0]; expect((await run('delete', '--memory', String(mem.id), '--yes')).code).toBe(0); expect(fake.notes.size).toBe(0);
    expect((await run('delete', '--all')).code).toBe(1); // needs --yes
  });
  it('disconnect removes local config and client wiring', async () => {
    const bin = join(paths.root, 'bin'); require('node:fs').mkdirSync(bin, { recursive: true });
    for (const c of ['claude', 'codex']) require('node:fs').writeFileSync(join(bin, c), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    saveConfig(paths, { ...cfg, clients: { claude: { mcp: true, hooks: true, skill: true, installedAt: '' } } });
    const r = await run('disconnect'); expect(r.code).toBe(0);
    expect(existsSync(paths.configFile)).toBe(false); expect(r.out).toContain('Notes on your ship were kept');
  });
});
