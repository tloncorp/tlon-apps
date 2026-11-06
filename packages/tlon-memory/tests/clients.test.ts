// tests/clients.test.ts
import { beforeEach, describe, expect, it } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installClient, uninstallClient, hookEntries } from '../src/clients';

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
    expect(calls[0]).toEqual(['claude', 'mcp', 'add', '-s', 'user', '-e', 'TLON_MEMORY_AGENT=claude-code', 'tlon-memory', '--', '/opt/tm/bin/tlon-memory.js', 'mcp']);
    expect(existsSync(join(home, '.claude', 'skills', 'tlon-memory', 'SKILL.md'))).toBe(true);
    expect(existsSync(settings + '.bak-tlon-memory')).toBe(true);
    await uninstallClient('claude', { home, binPath: '/opt/tm/bin/tlon-memory.js', exec, skillSource: '' });
    const after = JSON.parse(readFileSync(settings, 'utf8'));
    expect(after.hooks.Stop).toEqual([{ hooks: [{ type: 'command', command: 'other-tool' }] }]);
    expect(after.hooks.SessionStart).toBeUndefined();
    expect(calls.at(-1)).toEqual(['claude', 'mcp', 'remove', '-s', 'user', 'tlon-memory']);
    expect(existsSync(join(home, '.claude', 'skills', 'tlon-memory'))).toBe(false);
  });
  it('is idempotent', async () => {
    const o = { home, binPath: '/b', exec, skillSource: join(import.meta.dir, '..', 'SKILL.md') };
    await installClient('claude', o); await installClient('claude', o);
    const s = JSON.parse(readFileSync(join(home, '.claude', 'settings.json'), 'utf8'));
    expect(s.hooks.Stop.length).toBe(1);
  });
});

describe('codex installer', () => {
  it('writes hooks.json with Stop timeout 20 and SessionEnd timeout 3, registers MCP, installs skill', async () => {
    await installClient('codex', { home, binPath: '/b/tlon-memory.js', exec, skillSource: join(import.meta.dir, '..', 'SKILL.md') });
    const h = JSON.parse(readFileSync(join(home, '.codex', 'hooks.json'), 'utf8'));
    expect(h.hooks.SessionStart[0].hooks[0].command).toBe('"/b/tlon-memory.js" hook codex');
    expect(h.hooks.Stop[0].hooks[0].timeout).toBe(20);
    expect(h.hooks.SessionEnd[0].hooks[0].timeout).toBe(3);
    expect(calls[0]).toEqual(['codex', 'mcp', 'add', '--env', 'TLON_MEMORY_AGENT=codex', 'tlon-memory', '--', '/b/tlon-memory.js', 'mcp']);
    expect(existsSync(join(home, '.agents', 'skills', 'tlon-memory', 'SKILL.md'))).toBe(true);
  });
});

describe('hookEntries', () => {
  it('tags entries so they can be found later', () => {
    const e = hookEntries('claude', '/x/tlon-memory.js');
    for (const ev of Object.keys(e)) expect(e[ev][0].hooks[0].command).toContain('tlon-memory.js" hook claude');
  });
});
