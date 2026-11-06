// tests/config.test.ts
import { describe, expect, it, beforeEach } from 'bun:test';
import { mkdtempSync, statSync, readFileSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Paths } from '../src/paths';
import { defaultConfig, loadConfig, saveConfig, isInScope } from '../src/config';
import { appendLog } from '../src/log';

let paths: Paths;
beforeEach(() => { paths = new Paths(mkdtempSync(join(tmpdir(), 'tm-'))); });

describe('config', () => {
  it('round-trips and is mode 0600', () => {
    const c = { ...defaultConfig(), shipUrl: 'https://x.tlon.network', ship: '~zod', apiKey: 'k' };
    saveConfig(paths, c);
    expect(statSync(paths.configFile).mode & 0o777).toBe(0o600);
    expect(loadConfig(paths)).toEqual(c);
  });
  it('loads a config written by an older setup, ignoring fields it no longer uses', () => {
    const c = { ...defaultConfig(), shipUrl: 'https://x.tlon.network', ship: '~zod', apiKey: 'k' };
    writeFileSync(paths.configFile, JSON.stringify({ ...c, clients: { claude: { mcp: true, hooks: true, skill: true, installedAt: '' } }, binPath: '/x/bin/tlon-memory.js' }));
    expect(loadConfig(paths)).toMatchObject(c);
  });
  it('returns null when absent', () => {
    expect(loadConfig(paths)).toBeNull();
  });
  it('scope matches directory and children only', () => {
    const c = { ...defaultConfig(), scopes: ['/a/b'] };
    expect(isInScope(c, '/a/b')).toBe(true);
    expect(isInScope(c, '/a/b/c')).toBe(true);
    expect(isInScope(c, '/a/bc')).toBe(false);
    expect(isInScope(c, '/a')).toBe(false);
  });
  it('scope compares real paths, and / matches everything', () => {
    const base = mkdtempSync(join(tmpdir(), 'tm-scope-'));
    mkdirSync(join(base, 'real', 'proj'), { recursive: true });
    symlinkSync(join(base, 'real'), join(base, 'link'));
    expect(isInScope({ ...defaultConfig(), scopes: [join(base, 'real')] }, join(base, 'link', 'proj'))).toBe(true);
    expect(isInScope({ ...defaultConfig(), scopes: [join(base, 'link')] }, join(base, 'real', 'proj'))).toBe(true);
    expect(isInScope({ ...defaultConfig(), scopes: [join(base, 'other')] }, join(base, 'link', 'proj'))).toBe(false);
    expect(isInScope({ ...defaultConfig(), scopes: ['/'] }, '/anything/at/all')).toBe(true);
  });
  it('refuses a config with an unknown version', () => {
    writeFileSync(paths.configFile, JSON.stringify({ ...defaultConfig(), version: 2 }));
    expect(() => loadConfig(paths)).toThrow('unsupported config version 2');
  });
  it('log never stores the api key', () => {
    appendLog(paths, 'sync', { status: 401, session: 's1', apiKey: 'SECRET' } as any);
    const txt = readFileSync(paths.logFile, 'utf8');
    expect(txt).toContain('status=401');
    expect(txt).not.toContain('SECRET');
  });
});

describe('log redaction', () => {
  it('redacts secrets that appear in logged values', () => {
    const p = new Paths(mkdtempSync(join(tmpdir(), 'tm-log-')));
    appendLog(p, 'sync-error', { error: 'bad header Authorization: Bearer abc.def.ghi' });
    const txt = readFileSync(p.logFile, 'utf8');
    expect(txt).toContain('[redacted:bearer]');
    expect(txt).not.toContain('abc.def.ghi');
  });
});
