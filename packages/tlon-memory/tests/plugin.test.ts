// tests/plugin.test.ts
import { describe, expect, it } from 'bun:test';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Paths } from '../src/paths';
import { defaultConfig, saveConfig } from '../src/config';

const root = join(import.meta.dir, '..');
const json = (f: string) => JSON.parse(readFileSync(join(root, f), 'utf8'));
const { version } = json('package.json');

function sh(command: string, env: Record<string, string>, stdin: string): Promise<{ code: number | null; out: string; err: string }> {
  return new Promise((res) => {
    const p = spawn('sh', ['-c', command], { env: { PATH: process.env.PATH!, HOME: process.env.HOME!, ...env } });
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => res({ code, out, err }));
    p.stdin.end(stdin);
  });
}
function connectedHome() {
  const paths = new Paths(mkdtempSync(join(tmpdir(), 'tm-plugin-')));
  saveConfig(paths, { ...defaultConfig(), shipUrl: 'http://localhost:1', ship: '~zod', apiKey: 'k', scopes: ['/Users/bill/Projects/demo'],
    notebook: { host: '~zod', name: 'n', title: 'Agent Memory', rootFolderId: 1, conversationsFolderId: 2, memoriesFolderId: 3 },
    clients: { claude: { mcp: true, hooks: true, skill: true, installedAt: '' }, codex: { mcp: true, hooks: true, skill: true, installedAt: '' } } });
  return paths;
}
const START = readFileSync(join(import.meta.dir, 'fixtures', 'hook-claude-start.json'), 'utf8');
const MCP_INIT = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}\n{"jsonrpc":"2.0","id":2,"method":"tools/list"}\n';

describe('plugin manifests', () => {
  it('name and version agree everywhere', () => {
    for (const f of ['.claude-plugin/plugin.json', '.codex-plugin/plugin.json']) {
      const m = json(f);
      expect([f, m.name, m.version, m.author?.name]).toEqual([f, 'tlon-memory', version, 'Tlon']);
    }
    const mkt = json('.claude-plugin/marketplace.json');
    expect(mkt.name).toBe('tlon-memory');
    expect(mkt.plugins).toEqual([expect.objectContaining({ name: 'tlon-memory', source: './', version })]);
  });
  it('every path a manifest names exists', () => {
    const codex = json('.codex-plugin/plugin.json');
    for (const p of [codex.skills, codex.mcpServers, codex.hooks]) expect(existsSync(join(root, p))).toBe(true);
    expect(existsSync(join(root, 'skills', 'tlon-memory', 'SKILL.md'))).toBe(true);
  });
  it('hooks keep their per-client timeouts', () => {
    const timeouts = (f: string) => Object.fromEntries(Object.entries(json(f).hooks).map(([e, v]: [string, any]) => [e, v[0].hooks[0].timeout]));
    expect(timeouts('hooks/hooks.json')).toEqual({ SessionStart: 5, Stop: 20, SessionEnd: 20 });
    expect(timeouts('hooks/codex-hooks.json')).toEqual({ SessionStart: 5, Stop: 20, SessionEnd: 3 });
  });
});

describe('plugin commands', () => {
  it('each SessionStart hook prints the context line from the plugin root', async () => {
    const paths = connectedHome();
    for (const [f, client] of [['hooks/hooks.json', 'claude'], ['hooks/codex-hooks.json', 'codex']]) {
      const cmd: string = json(f).hooks.SessionStart[0].hooks[0].command;
      expect(cmd).toContain(`hook ${client}`);
      // Claude Code sets CLAUDE_PLUGIN_ROOT, Codex sets PLUGIN_ROOT.
      const r = await sh(cmd, { [client === 'claude' ? 'CLAUDE_PLUGIN_ROOT' : 'PLUGIN_ROOT']: root, TLON_MEMORY_HOME: paths.root }, START);
      expect([f, r.code, r.out]).toEqual([f, 0, expect.stringContaining('Tlon memory: connected as ~zod')]);
    }
  });
  it('the Claude MCP entry starts the server', async () => {
    const s = json('.mcp.json').mcpServers['tlon-memory'];
    expect(s.env).toEqual({ TLON_MEMORY_AGENT: 'claude-code' });
    const argv = [s.command, ...s.args].map((a: string) => `'${a.replaceAll('${CLAUDE_PLUGIN_ROOT}', root)}'`).join(' ');
    const r = await sh(argv, { TLON_MEMORY_HOME: connectedHome().root }, MCP_INIT);
    expect(r.out).toContain('"name":"tlon_search_memory"');
  });
  it('the Codex MCP entry finds the installed plugin and keeps the session cwd', async () => {
    const s = json('codex-mcp.json').mcpServers['tlon-memory'];
    expect(s.env).toEqual({ TLON_MEMORY_AGENT: 'codex' });
    expect(s.cwd).toBeUndefined(); // without cwd Codex starts the server in the session directory, which names the project
    expect(s.tool_timeout_sec).toBeGreaterThan(45); // tlon_backup_conversation runs up to 45 s
    const codexHome = mkdtempSync(join(tmpdir(), 'tm-codex-'));
    const cached = join(codexHome, 'plugins', 'cache', 'tlon-memory', 'tlon-memory');
    mkdirSync(cached, { recursive: true }); symlinkSync(root, join(cached, version));
    expect(s.env_vars).toEqual(['CODEX_HOME']);
    const argv = [s.command, ...s.args].map((a: string) => `'${a.replaceAll("'", `'\\''`)}'`).join(' ');
    const r = await sh(argv, { CODEX_HOME: codexHome, TLON_MEMORY_HOME: connectedHome().root }, MCP_INIT);
    expect(r.out).toContain('"name":"tlon_search_memory"');
  });
});
