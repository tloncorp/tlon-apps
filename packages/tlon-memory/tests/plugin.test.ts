// tests/plugin.test.ts
import { beforeAll, describe, expect, it } from 'bun:test';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Paths } from '../src/paths';
import { defaultConfig, saveConfig } from '../src/config';
import { installCommand, onPath, uninstallCommand } from '../src/plugin';

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
    notebook: { host: '~zod', name: 'n', title: 'Agent Memory', rootFolderId: 1, conversationsFolderId: 2, memoriesFolderId: 3 } });
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
  it('ships no root .mcp.json, which a session opened in the package would offer as a project server', () => {
    expect(existsSync(join(root, '.mcp.json'))).toBe(false);
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
  // The shim runs dist/ when it exists, so a stale build would test old code.
  beforeAll(() => { expect(spawnSync('node', [join(root, 'scripts', 'build.js')]).status).toBe(0); });
  it('each SessionStart hook prints the context line from the plugin root', async () => {
    const paths = connectedHome();
    for (const [f, client] of [['hooks/hooks.json', 'claude'], ['hooks/codex-hooks.json', 'codex']]) {
      const cmd: string = json(f).hooks.SessionStart[0].hooks[0].command;
      expect(cmd).toContain(`hook ${client}`);
      // Claude Code sets CLAUDE_PLUGIN_ROOT, Codex sets PLUGIN_ROOT.
      const r = await sh(cmd, { [client === 'claude' ? 'CLAUDE_PLUGIN_ROOT' : 'PLUGIN_ROOT']: root, TLON_MEMORY_HOME: paths.root }, START);
      expect([f, r.code, r.out]).toEqual([f, 0, expect.stringContaining('Tlon memory: connected as ~zod')]);
      expect(r.out.trim()).toEndWith(` · cli ${join(root, 'bin', 'tlon-memory.js')}`); // the shim, not the bundle it runs
    }
  });
  it('not set up: SessionStart and the MCP tools name the runnable setup command', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'tm-plugin-empty-')), cli = join(root, 'bin', 'tlon-memory.js');
    const cmd: string = json('hooks/hooks.json').hooks.SessionStart[0].hooks[0].command;
    const r = await sh(cmd, { CLAUDE_PLUGIN_ROOT: root, TLON_MEMORY_HOME: empty }, START);
    expect(r.out).toBe(`Tlon memory: not set up · run node ${cli} setup\n`);
    const call = MCP_INIT + '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"tlon_status","arguments":{}}}\n';
    expect((await sh(`node '${cli}' mcp`, { TLON_MEMORY_HOME: empty }, call)).out).toContain(`tlon-memory is not connected. Run: node ${cli} setup`);
    // Run without the shim there is no path to give, so the hook stays silent and the tool names the bare command.
    const main = join(root, 'src', 'main.ts');
    expect((await sh(`bun run '${main}' hook claude`, { TLON_MEMORY_HOME: empty }, START)).out).toBe('');
    expect((await sh(`bun run '${main}' mcp`, { TLON_MEMORY_HOME: empty }, call)).out).toContain('tlon-memory is not connected. Run: tlon-memory setup');
  });
  it('the Claude MCP entry starts the server', async () => {
    const s = json('.claude-plugin/plugin.json').mcpServers['tlon-memory'];
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

describe('install commands', () => {
  it('name the checkout, quoting a path the shell would split', () => {
    expect(installCommand('claude', '/r/tlon-memory')).toBe('claude plugin install tlon-memory --marketplace /r/tlon-memory');
    expect(installCommand('codex', "/My Code/it's")).toBe(`codex plugin marketplace add '/My Code/it'\\''s' && codex plugin add tlon-memory@tlon-memory`);
    expect(uninstallCommand('codex')).toBe('codex plugin remove tlon-memory@tlon-memory && codex plugin marketplace remove tlon-memory');
  });
  it('the marketplace and plugin names they use are the ones the manifests declare', () => {
    const mkt = json('.claude-plugin/marketplace.json');
    expect(uninstallCommand('claude')).toBe(`claude plugin uninstall ${mkt.plugins[0].name}@${mkt.name} && claude plugin marketplace remove ${mkt.name}`);
  });
  it('onPath finds only executables', () => {
    expect(onPath('sh', '/nonexistent:/bin')).toBe(true);
    expect(onPath('sh', '/nonexistent')).toBe(false);
    expect(onPath('passwd', '/etc')).toBe(false); // a file, not executable
  });
});
