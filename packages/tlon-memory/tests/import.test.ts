// tests/import.test.ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FakeNotes } from './fake-notes-server';
import { CLAUDE_ID, CODEX_ID, fakeHome } from './transcript-home';
import { NotesClient } from '../src/notes-client';
import { Paths } from '../src/paths';
import { Config, defaultConfig, saveConfig } from '../src/config';
import { ensureNotebook } from '../src/notebook';
import { claudeProjectsDir } from '../src/transcripts';

const fake = new FakeNotes(); let home: string; let claude: string; let paths: Paths; let cfg: Config;
let outside: string;
const OUTSIDE_ID = '33333333-aaaa-4bbb-8ccc-444444444444', EMPTY_ID = '55555555-aaaa-4bbb-8ccc-666666666666';
const main = join(import.meta.dir, '..', 'src', 'main.ts');
const run = async (args: string[]) => {
  const r = Bun.spawn(['bun', 'run', main, 'import', ...args], { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe',
    env: { ...process.env, HOME: home, TLON_MEMORY_HOME: paths.root } });
  const [out, err, code] = await Promise.all([new Response(r.stdout).text(), new Response(r.stderr).text(), r.exited]); return { code, out, err }; };
const conversations = () => [...fake.notes.values()].filter((n) => n.folderId === cfg.notebook!.conversationsFolderId);

beforeAll(async () => { fake.start(); const c = new NotesClient({ shipUrl: fake.url, apiKey: 'test-key' });
  cfg = { ...defaultConfig(), shipUrl: fake.url, ship: '~zod', apiKey: 'test-key', scopes: ['/Users/bill/Projects/demo'], notebook: await ensureNotebook(c, 'Agent Memory') }; });
afterAll(() => fake.stop());
beforeEach(() => {
  ({ home, claude } = fakeHome()); paths = new Paths(join(home, '.tlon', 'memory')); saveConfig(paths, cfg); fake.notes.clear();
  const elsewhere = join(claudeProjectsDir(home), '-elsewhere'); mkdirSync(elsewhere);
  outside = join(elsewhere, `${OUTSIDE_ID}.jsonl`);
  writeFileSync(outside, readFileSync(claude, 'utf8').replaceAll(CLAUDE_ID, OUTSIDE_ID).replaceAll('/Users/bill/Projects/demo', '/elsewhere'));
  writeFileSync(join(claudeProjectsDir(home), '-Users-bill-Projects-demo', `${EMPTY_ID}.jsonl`),
    JSON.stringify({ type: 'system', sessionId: EMPTY_ID, cwd: '/Users/bill/Projects/demo', content: 'x' }) + '\n');
  fake.requests.length = 0;
});

describe('import', () => {
  it('uploads one transcript and prints its URL; a second run is unchanged', async () => {
    const r = await run([claude]);
    expect(r.code).toBe(0);
    expect(r.out).toContain(`claude-code:${CLAUDE_ID} → 1 part(s) ${fake.url}/notes/nb/~zod/`);
    expect(conversations().length).toBe(1);
    const again = await run([claude]);
    expect(again.out).toContain(`claude-code:${CLAUDE_ID} → unchanged`);
    expect(conversations().length).toBe(1);
  });
  it('refuses a transcript outside the capture scope without a request', async () => {
    const r = await run([outside]);
    expect(r.code).toBe(1);
    expect(r.err).toContain('/elsewhere');
    expect(r.err).toContain('is outside the capture scope (/Users/bill/Projects/demo); add it with tlon-memory scope add');
    expect(fake.requests.length).toBe(0);
  });
  it('resolves --session for both clients', async () => {
    expect((await run(['--session', `codex:${CODEX_ID}`])).out).toContain(`codex:${CODEX_ID} → 1 part(s)`);
    expect((await run(['--session', `claude-code:${CLAUDE_ID}`])).out).toContain(`claude-code:${CLAUDE_ID} → 1 part(s)`);
    const missing = await run(['--session', 'codex:nope']); expect(missing.code).toBe(1); expect(missing.err).toContain('no transcript for codex:nope');
    expect((await run(['--session', 'gpt:x'])).code).toBe(2);
  });
  it('--all --dry-run lists in-scope sessions only and makes no requests', async () => {
    const r = await run(['--all', '--dry-run']);
    expect(r.code).toBe(0);
    expect(r.out).toContain(`claude-code:${CLAUDE_ID}  /Users/bill/Projects/demo  8 events  1 part(s)`);
    expect(r.out).toContain(`codex:${CODEX_ID}  /Users/bill/Projects/demo`);
    expect(r.out).toContain(`claude-code:${EMPTY_ID}  empty`);
    expect(r.out).not.toContain(OUTSIDE_ID);
    expect(r.out).toContain('2 to upload, 1 empty');
    expect(fake.requests.length).toBe(0);
  });
  it('--all uploads every in-scope session and skips the empty one', async () => {
    const r = await run(['--all']);
    expect(r.code).toBe(0);
    expect(r.out).toContain(`claude-code:${CLAUDE_ID} → 1 part(s)`);
    expect(r.out).toContain(`codex:${CODEX_ID} → 1 part(s)`);
    expect(r.out).toContain('synced 2, unchanged 0, failed 0, remaining 0');
    expect(r.out).not.toContain(EMPTY_ID);
    expect(conversations().length).toBe(2);
  });
  it('refuses while capture is paused', async () => {
    saveConfig(paths, { ...cfg, paused: true });
    const r = await run([claude]);
    expect(r.code).toBe(1); expect(r.err).toContain('Capture is paused; run tlon-memory resume first.');
    expect(fake.requests.length).toBe(0);
  });
});
