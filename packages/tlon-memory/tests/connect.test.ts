// tests/connect.test.ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { openConnectPage } from '../src/connect';
import { FakeNotes } from './fake-notes-server';

const form = (o: Record<string, string>) => ({ method: 'POST', body: new URLSearchParams(o), headers: { 'content-type': 'application/x-www-form-urlencoded' } });

describe('connect page', () => {
  it('serves the form on loopback under a random token, takes one POST, and holds its answer until setup finishes', async () => {
    const page = await openConnectPage(60_000);
    const u = new URL(page.url);
    expect(u.hostname).toBe('127.0.0.1'); expect(u.pathname).toMatch(/^\/[0-9a-f]{32}$/);
    expect((await fetch(`${u.origin}/${'0'.repeat(32)}`)).status).toBe(404);
    const get = await fetch(page.url);
    const html = await get.text();
    expect(get.status).toBe(200);
    for (const s of ['name="ship_url"', 'name="kind" value="code"', 'name="kind" value="key"', 'type="password"', 'tlon.network/signup']) expect(html).toContain(s);
    const first = fetch(page.url, form({ ship_url: 'https://zod.example', kind: 'key', secret: 'k1' }));
    expect(await page.submission).toEqual({ shipUrl: 'https://zod.example', kind: 'key', secret: 'k1' });
    expect((await fetch(page.url, form({ ship_url: 'x', kind: 'key', secret: 'k2' }))).status).toBe(410);
    expect((await fetch(page.url)).status).toBe(410);
    page.finish(true, 'Connected as ~zod <b>.');
    const r = await first;
    expect(await r.text()).toContain('Connected as ~zod &lt;b&gt;.');
  });
  it('expires', async () => {
    const page = await openConnectPage(50);
    expect(page.submission).rejects.toThrow('expired');
    await page.submission.catch(() => {});
    expect(await fetch(page.url).then((r) => r.status, () => 'closed')).toBe('closed');
  });
});

const fake = new FakeNotes(); let home: string; let tmHome: string;
const main = join(import.meta.dir, '..', 'src', 'main.ts');
/** Starts setup --connect and resolves the link it prints; `done` resolves when the process exits. */
async function startSetup(args: string[], env: Record<string, string> = {}) {
  const p = Bun.spawn(['bun', 'run', main, 'setup', '--connect', ...args], { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe',
    env: { ...process.env, HOME: home, TLON_MEMORY_HOME: tmHome, TLON_MEMORY_NO_BROWSER: '1', PATH: `${dirname(process.execPath)}:/usr/bin:/bin`, ...env } });
  let out = ''; const reader = p.stdout.getReader(); const dec = new TextDecoder();
  const pump = (async () => { for (;;) { const { value, done } = await reader.read(); if (done) return; out += dec.decode(value); } })();
  const done = Promise.all([pump, new Response(p.stderr).text(), p.exited]).then(([, err, code]) => ({ code, out, err }));
  const deadline = Date.now() + 15_000;
  let link: string | undefined;
  while (!(link = out.match(/Open (http:\/\/127\.0\.0\.1:\d+\/[0-9a-f]{32}) to connect your ship \(link expires in 10 minutes\)/)?.[1])) {
    if (Date.now() > deadline || p.exitCode !== null) return { link: '', done };
    await Bun.sleep(20);
  }
  return { link, done };
}
beforeAll(() => fake.start()); afterAll(() => fake.stop());
beforeEach(() => { home = mkdtempSync(join(tmpdir(), 'tm-connect-')); tmHome = join(home, '.tlon', 'memory'); fake.notebooks.clear(); fake.folders.clear(); fake.notes.clear(); fake.apiKey = 'test-key'; });

describe('setup --connect', () => {
  const args = ['--scope', '/p', '--notebook', 'AM', '--yes'];
  it('connects with a key posted from the page and writes config 0600', async () => {
    const { link, done } = await startSetup(args);
    expect((await fetch(link)).status).toBe(200);
    const page = await fetch(link, form({ ship_url: `${fake.url}/apps/groups/`, kind: 'key', secret: 'test-key' }));
    expect(await page.text()).toContain('Connected as ~zod. You can close this tab.');
    const r = await done;
    expect(r.code).toBe(0);
    expect(r.out).toContain('Connected as ~zod'); expect(r.out).not.toContain('Install the plugin');
    expect(r.out + r.err).not.toContain('test-key');
    const cfg = JSON.parse(readFileSync(join(tmHome, 'config.json'), 'utf8'));
    expect(statSync(join(tmHome, 'config.json')).mode & 0o777).toBe(0o600);
    expect([cfg.shipUrl, cfg.apiKey, cfg.scopes, cfg.notebook.title]).toEqual([fake.url, 'test-key', ['/p'], 'AM']);
  });
  it('exchanges a +code posted from the page and stores only the key', async () => {
    const { link, done } = await startSetup(args);
    await (await fetch(link, form({ ship_url: fake.url, kind: 'code', secret: fake.code }))).text();
    const r = await done;
    expect(r.code).toBe(0); expect(r.out + r.err).not.toContain(fake.code);
    expect(readFileSync(join(tmHome, 'config.json'), 'utf8')).not.toContain(fake.code);
  });
  it('shows a rejected key on the page and exits 1 without config', async () => {
    const { link, done } = await startSetup(args);
    const page = await (await fetch(link, form({ ship_url: fake.url, kind: 'key', secret: 'wrong' }))).text();
    expect(page).toContain('rejected the API key'); expect(page).not.toContain('wrong');
    expect((await done).code).toBe(1);
    expect(existsSync(join(tmHome, 'config.json'))).toBe(false);
  });
  it('gives up when nobody submits the form', async () => {
    const { link, done } = await startSetup(args, { TLON_MEMORY_CONNECT_TIMEOUT_MS: '300' });
    expect(link).toBe(''); // the printed duration follows the override, so the 10-minute pattern does not match
    const r = await done;
    expect(r.code).toBe(1); expect(r.out).toMatch(/Open http:\/\/127\.0\.0\.1:\d+\/[0-9a-f]{32} to connect your ship \(link expires in 0\.3 seconds\)/);
    expect(r.err).toContain('expired'); expect(existsSync(join(tmHome, 'config.json'))).toBe(false);
  });
  it('--connect does not take the ship URL or secret from flags', async () => {
    const p = Bun.spawn(['bun', 'run', main, 'setup', '--connect', '--api-key-stdin', ...args], { stdout: 'pipe', stderr: 'pipe', env: { ...process.env, HOME: home, TLON_MEMORY_HOME: tmHome } });
    expect(await p.exited).toBe(2); expect(await new Response(p.stderr).text()).toContain('--connect');
  });
});
