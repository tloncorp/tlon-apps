// tests/commands.test.ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FakeNotes } from './fake-notes-server';
import { NotesClient } from '../src/notes-client';
import { Paths } from '../src/paths';
import { Config, defaultConfig, saveConfig, loadConfig } from '../src/config';
import { ensureNotebook } from '../src/notebook';
import { MemoryStore } from '../src/memory';
import { enqueue, syncQueue } from '../src/sync';
import { listJobs, pendingLinksFile, savePendingLinks } from '../src/state';
import { hookEntries } from '../src/clients';
import { BIN_PATH } from '../src/setup';

const fake = new FakeNotes(); let home: string; let paths: Paths; let cfg: Config;
const main = join(import.meta.dir, '..', 'src', 'main.ts');
const SESSION = 'claude-code:11111111-aaaa-4bbb-8ccc-222222222222';
// Async spawn: spawnSync would block this process's event loop, so the in-process fake server could not answer the child.
// HOME is a temp dir so `disconnect` never touches the real ~/.claude or ~/.codex; fake `claude`/`codex` record their args.
const run = async (args: string[], input?: string) => {
  const r = Bun.spawn(['bun', 'run', main, ...args], { stdin: input === undefined ? 'ignore' : new TextEncoder().encode(input), stdout: 'pipe', stderr: 'pipe',
    env: { ...process.env, HOME: home, TLON_MEMORY_HOME: paths.root, PATH: `${home}/bin:${process.env.PATH}` } });
  const [out, err, code] = await Promise.all([new Response(r.stdout).text(), new Response(r.stderr).text(), r.exited]); return { code, out, err }; };
beforeAll(async () => { fake.start(); const c = new NotesClient({ shipUrl: fake.url, apiKey: 'test-key' });
  cfg = { ...defaultConfig(), shipUrl: fake.url, ship: '~zod', apiKey: 'test-key', scopes: ['/Users/bill/Projects/demo'], notebook: await ensureNotebook(c, 'Agent Memory') }; });
afterAll(() => fake.stop());
beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'tm-cmd-')); paths = new Paths(join(home, '.tlon', 'memory')); saveConfig(paths, cfg); fake.notes.clear(); fake.apiKey = 'test-key';
  mkdirSync(join(home, 'bin'));
  for (const c of ['claude', 'codex']) writeFileSync(join(home, 'bin', c), `#!/bin/sh\necho "$@" >> "${home}/${c}.calls"\nexit 0\n`, { mode: 0o755 });
  const fx = join(home, 't.jsonl'); copyFileSync(join(import.meta.dir, 'fixtures', 'claude-session.jsonl'), fx);
  enqueue(paths, { client: 'claude', sessionId: 's', transcriptPath: fx, cwd: '/Users/bill/Projects/demo' }); await syncQueue(paths, cfg, { budgetMs: 10_000 });
  await new MemoryStore(paths, cfg).save({ type: 'decision', text: 'Use SQLite.', agent: 'claude-code', project: 'demo', sessionKey: SESSION, event: 'e2' }); });

describe('commands', () => {
  it('status shows connection, scope, counts without listing note bodies', async () => {
    fake.requests.length = 0;
    const r = await run(['status']); expect(r.code).toBe(0);
    expect(r.out).toContain('~zod'); expect(r.out).toContain('/Users/bill/Projects/demo');
    expect(r.out).toContain('memories: 1'); expect(r.out).toContain('conversations synced from this device: 1'); expect(r.out).not.toContain('test-key');
    expect(fake.requests.some((q) => q.method === 'GET' && /\/notes$/.test(q.path.split('?')[0]))).toBe(false);
    expect(r.out).toContain('newest 2000 notes'); expect(r.out).not.toContain('scan truncated');
  });
  it('status tells a rejected key from an unreachable ship and still shows the memories line', async () => {
    saveConfig(paths, { ...cfg, apiKey: 'wrong' });
    expect((await run(['status'])).out).toContain('memories: unknown (key rejected: the ship rejected the API key)');
    saveConfig(paths, { ...cfg, shipUrl: 'http://127.0.0.1:1' });
    expect((await run(['status'])).out).toContain('memories: unknown (ship unreachable: cannot reach http://127.0.0.1:1');
  });
  it('status says when the memory scan hit the search horizon', async () => {
    const nb = cfg.notebook!; const nbId = [...fake.notebooks.values()][0].id;
    for (let i = 0; i < 2050; i++) fake.notes.set(60_000 + i, { id: 60_000 + i, notebookId: nbId, folderId: nb.conversationsFolderId, title: 't', slug: null, bodyMd: 'x', createdBy: '~zod', createdAt: 1, updatedBy: '~zod', updatedAt: 1, revision: 1 });
    const r = await run(['status']);
    expect(r.out).toContain('scan truncated');
  });
  it('pause/resume toggle and scope add/remove/list', async () => {
    expect((await run(['pause'])).out).toContain('paused'); expect(loadConfig(paths)!.paused).toBe(true);
    expect((await run(['resume'])).out).toContain('resumed'); expect(loadConfig(paths)!.paused).toBe(false);
    const dir = mkdtempSync(join(tmpdir(), 'tm-scope-'));
    await run(['scope', 'add', dir]); expect(loadConfig(paths)!.scopes).toContain(dir);
    expect((await run(['scope', 'list'])).out).toContain(dir);
    await run(['scope', 'remove', dir]); expect(loadConfig(paths)!.scopes).not.toContain(dir);
  });
  it('scope add refuses home or / without --force-scope, and a missing directory', async () => {
    const r = await run(['scope', 'add', home]); expect(r.code).toBe(2); expect(r.err).toContain('--force-scope');
    expect((await run(['scope', 'add', '/'])).code).toBe(2);
    expect((await run(['scope', 'add', join(home, 'nope')])).code).toBe(2);
    expect(loadConfig(paths)!.scopes).toEqual(cfg.scopes);
    const parent = join(home, '..');
    const up = await run(['scope', 'add', parent]); expect(up.code).toBe(2); expect(up.err).toContain('--force-scope');
    expect((await run(['scope', 'add', home, '--force-scope'])).code).toBe(0); expect(loadConfig(paths)!.scopes).toContain(home);
  });
  it('sync runs a job that is still backing off', async () => {
    const fx = join(home, 't.jsonl');
    writeFileSync(fx, readFileSync(fx, 'utf8') + '\n');
    enqueue(paths, { client: 'claude', sessionId: 's', transcriptPath: fx, cwd: '/Users/bill/Projects/demo' });
    const j = listJobs(paths)[0];
    writeFileSync(join(paths.queueDir, 'claude-s.json'), JSON.stringify({ ...j, attempts: 3, nextAttemptAt: new Date(Date.now() + 3_600_000).toISOString() }));
    const r = await run(['sync']);
    expect(r.out).toContain('synced 1, failed 0, remaining 0');
    expect(listJobs(paths).length).toBe(0);
  });
  it('sync says when another sync holds the lock', async () => {
    enqueue(paths, { client: 'claude', sessionId: 's2', transcriptPath: join(home, 't.jsonl'), cwd: '/Users/bill/Projects/demo' });
    writeFileSync(paths.queueLock, JSON.stringify({ pid: 1, at: new Date().toISOString() }));
    const r = await run(['sync']);
    expect(r.code).toBe(0); expect(r.out).toContain('another sync is running; 1 job queued');
  });
  it('export writes private markdown + index without the key, by default under HOME', async () => {
    const out = join(home, 'export'); const r = await run(['export', '--out', out]); expect(r.code).toBe(0);
    expect(r.out).toContain('sensitive');
    expect(statSync(out).mode & 0o777).toBe(0o700);
    const conv = readdirSync(join(out, 'conversations')); expect(conv.length).toBe(1); expect(readdirSync(join(out, 'memories')).length).toBe(1);
    expect(statSync(join(out, 'conversations', conv[0])).mode & 0o777).toBe(0o600);
    const idx = JSON.parse(readFileSync(join(out, 'index.json'), 'utf8')); expect(idx.notes.length).toBe(2); expect(JSON.stringify(idx)).not.toContain('test-key');
    const d = await run(['export']); expect(d.code).toBe(0);
    expect(readdirSync(home).some((f) => f.startsWith('tlon-memory-export-'))).toBe(true);
  });
  it('delete --session removes the conversation note, local state and queued job; --memory removes a memory; --all needs --yes', async () => {
    enqueue(paths, { client: 'claude', sessionId: '11111111-aaaa-4bbb-8ccc-222222222222', transcriptPath: '/x', cwd: '/y' });
    savePendingLinks(paths, 'claude-code', '11111111-aaaa-4bbb-8ccc-222222222222', [{ memoryId: 1 }]);
    const r = await run(['delete', '--session', SESSION, '--yes']); expect(r.code).toBe(0); expect(r.out).toContain('pause capture first');
    expect([...fake.notes.values()].filter((n) => n.folderId === cfg.notebook!.conversationsFolderId).length).toBe(0);
    expect(readdirSync(paths.stateDir).filter((f) => /^(claude-code|codex)-/.test(f)).length).toBe(0);
    expect(existsSync(pendingLinksFile(paths, 'claude-code', '11111111-aaaa-4bbb-8ccc-222222222222'))).toBe(false);
    expect(listJobs(paths).length).toBe(0);
    const mem = [...fake.notes.values()][0]; expect((await run(['delete', '--memory', String(mem.id), '--yes'])).code).toBe(0); expect(fake.notes.size).toBe(0);
    expect((await run(['delete', '--all'])).code).toBe(1); // needs --yes
  });
  it('delete validates its arguments and only deletes memories with --memory', async () => {
    expect((await run(['delete', '--memory', 'abc', '--yes'])).code).toBe(2);
    expect((await run(['delete', '--memory', '0', '--yes'])).code).toBe(2);
    expect((await run(['delete', '--session', 'gpt:abc', '--yes'])).code).toBe(2);
    const conv = [...fake.notes.values()].find((n) => n.folderId === cfg.notebook!.conversationsFolderId)!;
    const r = await run(['delete', '--memory', String(conv.id), '--yes']); expect(r.code).toBe(1); expect(r.err).toContain('not a memory');
    expect(fake.notes.has(conv.id)).toBe(true);
  });
  it('delete --all removes every queued job', async () => {
    enqueue(paths, { client: 'codex', sessionId: 'x', transcriptPath: '/x', cwd: '/y' });
    savePendingLinks(paths, 'codex', 'x', [{ memoryId: 1 }]);
    expect((await run(['delete', '--all', '--yes'])).code).toBe(0);
    expect(existsSync(pendingLinksFile(paths, 'codex', 'x'))).toBe(false);
    expect(fake.notes.size).toBe(0); expect(listJobs(paths).length).toBe(0);
  });
});

describe('disconnect', () => {
  const settings = () => join(home, '.claude', 'settings.json');
  const skill = () => join(home, '.claude', 'skills', 'tlon-memory');
  function seedClaude() {
    mkdirSync(skill(), { recursive: true }); writeFileSync(join(skill(), 'SKILL.md'), 'x');
    const ours = hookEntries('claude', BIN_PATH);
    writeFileSync(settings(), JSON.stringify({ model: 'opus', hooks: { ...ours, Stop: [{ hooks: [{ type: 'command', command: 'other-tool' }] }, ...ours.Stop] } }));
  }
  it('removes only what tlon-memory owns, client hooks and skill, and reports mcp remove', async () => {
    seedClaude(); writeFileSync(join(paths.root, 'notes.txt'), 'mine');
    const r = await run(['disconnect']); expect(r.code).toBe(0);
    expect(existsSync(paths.configFile)).toBe(false); expect(existsSync(paths.stateDir)).toBe(false); expect(existsSync(paths.queueDir)).toBe(false);
    expect(readFileSync(join(paths.root, 'notes.txt'), 'utf8')).toBe('mine');
    expect(r.out).toContain('Notes on your ship were kept');
    const s = JSON.parse(readFileSync(settings(), 'utf8'));
    expect(s.model).toBe('opus'); expect(s.hooks).toEqual({ Stop: [{ hooks: [{ type: 'command', command: 'other-tool' }] }] });
    expect(existsSync(skill())).toBe(false);
    expect(readFileSync(join(home, 'claude.calls'), 'utf8')).toContain('mcp remove -s user tlon-memory');
    expect(readFileSync(join(home, 'codex.calls'), 'utf8')).toContain('mcp remove tlon-memory');
    expect(r.out).toMatch(/claude: hooks and skill removed · MCP server removed/);
    expect(r.out).toContain('codex: no hooks or skill to remove');
    expect(existsSync(settings() + '.bak-tlon-memory')).toBe(false);
  });
  it('a second disconnect says nothing was there, including Codex answering "not found" with exit 0', async () => {
    seedClaude(); await run(['disconnect']);
    writeFileSync(join(home, 'bin', 'codex'), `#!/bin/sh\necho "No MCP server named 'tlon-memory' found."\nexit 0\n`, { mode: 0o755 });
    const r = await run(['disconnect']); expect(r.code).toBe(0);
    expect(r.out).toContain('claude: no hooks or skill to remove');
    expect(r.out).toContain('codex: no hooks or skill to remove · MCP server was not registered');
    expect(r.out).toContain('No local config, state or queue to remove.');
  });
  it('works with a corrupt config and removes an emptied root', async () => {
    seedClaude(); writeFileSync(paths.configFile, '{ broken');
    const r = await run(['disconnect']); expect(r.code).toBe(0);
    expect(existsSync(paths.root)).toBe(false); expect(existsSync(skill())).toBe(false);
  });
  it('reports a failing mcp remove instead of claiming success', async () => {
    writeFileSync(join(home, 'bin', 'codex'), '#!/bin/sh\necho "boom" >&2\nexit 4\n', { mode: 0o755 });
    const r = await run(['disconnect']); expect(r.out).toContain('codex: no hooks or skill to remove · MCP remove exited 4: boom'); expect(r.code).toBe(1);
  });
  it('--revoke-key failing leaves everything installed', async () => {
    seedClaude();
    const r = await run(['disconnect', '--revoke-key'], 'wrong-code\n'); expect(r.code).toBe(1);
    expect(r.err).toContain('Nothing was removed');
    expect(existsSync(paths.configFile)).toBe(true); expect(existsSync(skill())).toBe(true);
    expect(existsSync(join(home, 'claude.calls'))).toBe(false);
  });
  it('--revoke-key rotates the key first, then uninstalls', async () => {
    const r = await run(['disconnect', '--revoke-key'], `${fake.code}\n`); expect(r.code).toBe(0);
    expect(fake.apiKey).not.toBe('test-key'); expect(r.out).toContain('rotated'); expect(existsSync(paths.configFile)).toBe(false);
  });
});
