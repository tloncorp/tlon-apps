// tests/clients.test.ts
import { beforeEach, describe, expect, it } from 'bun:test';
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installClient, uninstallClient, hookEntries, makeExec } from '../src/clients';

let home: string; let calls: string[][];
const exec = async (cmd: string, args: string[]) => { calls.push([cmd, ...args]); return { code: 0, out: '', err: '' }; };
beforeEach(() => { home = mkdtempSync(join(tmpdir(), 'tm-cli-')); calls = []; mkdirSync(join(home, '.claude'), { recursive: true }); mkdirSync(join(home, '.codex'), { recursive: true }); });

describe('claude installer', () => {
  it('merges hooks, keeps existing ones, registers MCP, installs skill; uninstall reverses only ours', async () => {
    const settings = join(home, '.claude', 'settings.json');
    writeFileSync(settings, JSON.stringify({ model: 'opus', hooks: { Stop: [{ hooks: [{ type: 'command', command: 'other-tool' }] }] } }));
    await installClient('claude', { home, binPath: '/opt/tm/bin/tlon-memory.js', exec, skillSource: join(import.meta.dir, '..', 'SKILL.md') });
    const s = JSON.parse(readFileSync(settings, 'utf8'));
    expect(s.model).toBe('opus');
    expect(s.hooks.Stop.length).toBe(2);
    expect(s.hooks.SessionStart[0].hooks[0].command).toBe('"/opt/tm/bin/tlon-memory.js" hook claude');
    expect(s.hooks.Stop[1].hooks[0].timeout).toBe(20);
    expect(s.hooks.SessionEnd[0].hooks[0].command).toContain('hook claude');
    expect(calls).toEqual([['claude', 'mcp', 'add', '-s', 'user', 'tlon-memory', '-e', 'TLON_MEMORY_AGENT=claude-code', '--', '/opt/tm/bin/tlon-memory.js', 'mcp']]);
    expect(existsSync(join(home, '.claude', 'skills', 'tlon-memory', 'SKILL.md'))).toBe(true);
    expect(existsSync(settings + '.bak-tlon-memory')).toBe(true);
    const u = await uninstallClient('claude', { home, binPath: '/opt/tm/bin/tlon-memory.js', exec, skillSource: '' });
    expect(u).toMatchObject({ hooks: true, skill: true });
    const after = JSON.parse(readFileSync(settings, 'utf8'));
    expect(after.hooks.Stop).toEqual([{ hooks: [{ type: 'command', command: 'other-tool' }] }]);
    expect(after.hooks.SessionStart).toBeUndefined();
    expect(calls.at(-1)).toEqual(['claude', 'mcp', 'remove', '-s', 'user', 'tlon-memory']);
    expect(existsSync(join(home, '.claude', 'skills', 'tlon-memory'))).toBe(false);
    expect(await uninstallClient('claude', { home, binPath: '/opt/tm/bin/tlon-memory.js', exec, skillSource: '' })).toMatchObject({ hooks: false, skill: false });
  });
  it('is idempotent', async () => {
    const o = { home, binPath: '/b', exec, skillSource: join(import.meta.dir, '..', 'SKILL.md') };
    await installClient('claude', o); await installClient('claude', o);
    const s = JSON.parse(readFileSync(join(home, '.claude', 'settings.json'), 'utf8'));
    expect(s.hooks.Stop.length).toBe(1);
  });
});

describe('hook file merging', () => {
  const skillSource = join(import.meta.dir, '..', 'SKILL.md');
  const o = () => ({ home, binPath: '/b/tlon-memory.js', exec, skillSource });
  const other = (cmd: string) => ({ hooks: [{ type: 'command', command: cmd }] });
  const read = (f: string) => JSON.parse(readFileSync(f, 'utf8'));
  const codexFile = () => join(home, '.codex', 'hooks.json');

  it('re-install keeps our entry and other tools\' entries at the same index', async () => {
    await installClient('codex', o());
    const h = read(codexFile()); h.hooks.Stop.push(other('other-tool')); writeFileSync(codexFile(), JSON.stringify(h));
    await installClient('codex', { ...o(), binPath: '/new/tlon-memory.js' });
    const after = read(codexFile());
    expect(after.hooks.Stop.length).toBe(2);
    expect(after.hooks.Stop[0].hooks[0].command).toBe('"/new/tlon-memory.js" hook codex');
    expect(after.hooks.Stop[1]).toEqual(other('other-tool'));
  });
  it('owns hooks, not entries: a shared entry keeps the other tool\'s hook', async () => {
    writeFileSync(codexFile(), JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: 'command', command: '"/b/tlon-memory.js" hook codex' }, { type: 'command', command: 'other-tool' }] }] } }));
    await uninstallClient('codex', o());
    expect(read(codexFile()).hooks.Stop).toEqual([other('other-tool')]);
  });
  it('reports when uninstall shifts a later entry (Codex trust is per index)', async () => {
    await installClient('codex', o());
    const h = read(codexFile()); h.hooks.Stop.push(other('later-tool')); writeFileSync(codexFile(), JSON.stringify(h));
    expect((await uninstallClient('codex', o())).shifted).toBe(true);
    writeFileSync(codexFile(), JSON.stringify({ hooks: { Stop: [other('earlier-tool')] } }));
    await installClient('codex', o());
    expect((await uninstallClient('codex', o())).shifted).toBe(false);
  });
  it('refuses a file with an unexpected shape or bad JSON, naming it', async () => {
    const settings = join(home, '.claude', 'settings.json');
    writeFileSync(settings, JSON.stringify({ hooks: { Stop: {} } }));
    await expect(installClient('claude', o())).rejects.toThrow('cannot parse ~/.claude/settings.json: hooks.Stop is not an array');
    writeFileSync(settings, JSON.stringify({ hooks: { Stop: [{ command: 'x' }] } }));
    await expect(installClient('claude', o())).rejects.toThrow('hooks.Stop[0] has no "hooks" array');
    writeFileSync(settings, '{ nope');
    await expect(uninstallClient('claude', o())).rejects.toThrow('cannot parse ~/.claude/settings.json:');
    expect(readFileSync(settings, 'utf8')).toBe('{ nope');
  });
  it('writes atomically through a symlink, keeps the file mode, and backs up on every change', async () => {
    const real = join(home, 'dotfiles-settings.json'); writeFileSync(real, JSON.stringify({ model: 'a' })); chmodSync(real, 0o644);
    const settings = join(home, '.claude', 'settings.json'); symlinkSync(real, settings);
    await installClient('claude', o());
    expect(lstatSync(settings).isSymbolicLink()).toBe(true);
    expect(read(real).hooks.Stop.length).toBe(1);
    expect(statSync(real).mode & 0o777).toBe(0o644);
    const r = read(real); r.model = 'b'; writeFileSync(real, JSON.stringify(r));
    await uninstallClient('claude', o());
    expect(read(settings + '.bak-tlon-memory').model).toBe('b');
    await installClient('codex', o());
    expect(statSync(codexFile()).mode & 0o777).toBe(0o600);
  });
});

describe('codex installer', () => {
  it('writes hooks.json with Stop timeout 20 and SessionEnd timeout 3, registers MCP, installs skill', async () => {
    await installClient('codex', { home, binPath: '/b/tlon-memory.js', exec, skillSource: join(import.meta.dir, '..', 'SKILL.md') });
    const h = JSON.parse(readFileSync(join(home, '.codex', 'hooks.json'), 'utf8'));
    expect(h.hooks.SessionStart[0].hooks[0].command).toBe('"/b/tlon-memory.js" hook codex');
    expect(h.hooks.Stop[0].hooks[0].timeout).toBe(20);
    expect(h.hooks.SessionEnd[0].hooks[0].timeout).toBe(3);
    expect(calls).toEqual([['codex', 'mcp', 'add', '--env', 'TLON_MEMORY_AGENT=codex', 'tlon-memory', '--', '/b/tlon-memory.js', 'mcp']]);
    expect(existsSync(join(home, '.agents', 'skills', 'tlon-memory', 'SKILL.md'))).toBe(true);
  });
});

describe('skill install', () => {
  it('writes the embedded skill text when the source file is missing', async () => {
    await installClient('claude', { home, binPath: '/b', exec, skillSource: join(home, 'missing', 'SKILL.md'), skillText: '# embedded skill\n' });
    expect(readFileSync(join(home, '.claude', 'skills', 'tlon-memory', 'SKILL.md'), 'utf8')).toBe('# embedded skill\n');
  });
});

describe('mcp registration', () => {
  const skillSource = join(import.meta.dir, '..', 'SKILL.md');
  it('replaces an existing registration only after add reports it exists', async () => {
    let adds = 0;
    const ex = async (cmd: string, args: string[]) => {
      calls.push([cmd, ...args]);
      if (args[1] === 'add' && ++adds === 1) return { code: 1, out: '', err: 'MCP server tlon-memory already exists in user config' };
      return { code: 0, out: '', err: '' };
    };
    const r = await installClient('claude', { home, binPath: '/b', exec: ex, skillSource });
    expect(r.mcp).toBe(true);
    expect(calls.map((c) => c[2])).toEqual(['add', 'remove', 'add']);
  });
  it('a failed add for another reason leaves the existing registration alone', async () => {
    const ex = async (cmd: string, args: string[]) => { calls.push([cmd, ...args]); return { code: 1, out: '', err: 'invalid scope' }; };
    const r = await installClient('claude', { home, binPath: '/b', exec: ex, skillSource });
    expect(r).toMatchObject({ mcp: false, mcpError: 'invalid scope' });
    expect(calls.map((c) => c[2])).toEqual(['add']);
  });
});

describe('exec', () => {
  it('kills a command that runs past the timeout and reports it', async () => {
    const t0 = Date.now();
    const r = await makeExec(200)('sleep', ['5']);
    expect(Date.now() - t0).toBeLessThan(3000);
    expect(r.code).not.toBe(0); expect(r.err).toContain('timed out');
  });
  it('returns output and exit code', async () => {
    expect(await makeExec(5000)('sh', ['-c', 'echo hi; exit 3'])).toMatchObject({ code: 3, out: 'hi\n' });
  });
});

describe('hookEntries', () => {
  it('tags entries so they can be found later', () => {
    const e = hookEntries('claude', '/x/tlon-memory.js');
    for (const ev of Object.keys(e)) expect(e[ev][0].hooks[0].command).toContain('tlon-memory.js" hook claude');
  });
});
