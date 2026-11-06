// src/setup.ts
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { flag, has } from './cli-util';
import { Config, defaultConfig, loadConfig, saveConfig } from './config';
import { detectClient, installClient } from './clients';
import { MemoryStore } from './memory';
import { ensureNotebook, noteUrl } from './notebook';
import { NotesClient, NotesError } from './notes-client';
import { Paths } from './paths';
import { ask, askHidden, confirm, readSecret } from './prompt';
import { markInitialized } from './state';
import { saveConnection } from './status';

export const SIGNUP_URL = 'https://tlon.network/signup?source=agent';
const here = dirname(fileURLToPath(import.meta.url));
export const BIN_PATH = resolve(here, '..', 'bin', 'tlon-memory.js');
export const SKILL_SOURCE = resolve(here, '..', 'SKILL.md');

export const DISCLOSURE = `tlon-memory stores selected Claude Code / Codex conversations and memories in a Notes
notebook on your Tlon ship, and lets those agents search them.

Access requested: your ship's Notes API key. That key
can read and write all Notes on your ship (every notebook you can edit, including group
notebooks) but nothing else: no chat, DMs, groups, contacts, or ship administration. Only the key is stored, in
~/.tlon/memory/config.json (readable by you only). Your +code is never stored.

What is uploaded: for directories you choose, the user and assistant text of each
session, tool calls and results (truncated to 2 KB each), and interruption markers,
with timestamps. Not uploaded: thinking, system prompts, subagent transcripts,
attachments, and bookkeeping. Secrets matching common patterns are redacted. Nothing
is summarized. Details: README.md.
`;

export const PRIVACY_NOTE = `Note: when an agent retrieves Tlon content, that content is sent to the model provider
configured for that client (Anthropic for Claude Code, OpenAI for Codex).`;


export async function setup(args: string[]): Promise<number> {
  const paths = new Paths(); const yes = has(args, '--yes');
  const out = (s: string) => process.stdout.write(s + '\n');
  out(DISCLOSURE);
  if (!yes && !(await confirm('Continue?'))) return 1;

  const existing = loadConfig(paths);
  const reconnect = has(args, '--reconnect') && existing;
  const cfg: Config = reconnect ? existing! : defaultConfig();

  // 1. account
  if (!reconnect) {
    if (has(args, '--new-account') || (!yes && !flag(args, '--ship-url') && !(await confirm('Do you already have a Tlon account (a ship URL like https://sampel-palnet.tlon.network)?')))) {
      out(`\nCreate an account at ${SIGNUP_URL} (opens in your browser; sign-up may require an invite or be capacity-limited).`);
      out('When you have your ship URL from the dashboard, re-run `tlon-memory setup`.');
      if (!process.env.TLON_MEMORY_NO_BROWSER) try { const { spawn } = await import('node:child_process'); spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [SIGNUP_URL], { stdio: 'ignore', detached: true }).unref(); } catch {}
      return 0;
    }
    cfg.shipUrl = (flag(args, '--ship-url') ?? (await ask('Ship URL:'))).replace(/\/+$/, '');
    if (!/^https?:\/\//.test(cfg.shipUrl)) { process.stderr.write('ship URL must start with http(s)://\n'); return 1; }
  }

  // 2. credential (paste key, or +code once)
  let apiKey: string;
  if (has(args, '--api-key-stdin')) apiKey = await readSecret('Notes API key:', '--api-key-stdin');
  else if (has(args, '--code-stdin')) apiKey = await NotesClient.apiKeyFromCode(cfg.shipUrl, await readSecret('+code:', '--code-stdin')).catch((e) => { throw new Error(`could not fetch the API key with +code: ${e.message}`); });
  else {
    out('\nHow do you want to authorize?\n  1) paste your Notes API key\n  2) enter your +code once (used only to fetch the key, then discarded)');
    const choice = await ask('Choice:', '2');
    if (choice === '1') apiKey = await askHidden('Notes API key:');
    else { const code = await askHidden('+code:'); apiKey = await NotesClient.apiKeyFromCode(cfg.shipUrl, code); }
  }
  if (!apiKey) { process.stderr.write('no API key provided\n'); return 1; }

  // 3. verify
  const client = new NotesClient({ shipUrl: cfg.shipUrl, apiKey });
  try { cfg.ship = await client.hostName(); await client.listNotebooks(); }
  catch (e) { process.stderr.write(`Could not connect: ${(e as Error).message}\n`); return 1; }
  cfg.apiKey = apiKey; saveConnection(paths, { state: 'ok', checkedAt: new Date().toISOString() }); markInitialized(paths);
  out(`\nConnected as ${cfg.ship}.`);

  // 4. notebook
  if (!reconnect) {
    const title = flag(args, '--notebook') ?? (yes ? 'Agent Memory' : await ask('Notebook title:', 'Agent Memory'));
    cfg.notebook = await ensureNotebook(client, title);
    out(`Notebook "${title}" ready (${cfg.notebook.host}/${cfg.notebook.name}) with folders conversations/ and memories/.`);
    // 5. scope + tool I/O
    const scope = flag(args, '--scope') ?? (yes ? process.cwd() : await ask('Capture conversations started in which directory?', process.cwd()));
    cfg.scopes = scope === 'none' ? [] : [resolve(scope)];
    cfg.captureToolIo = !has(args, '--no-tool-io') && (yes || (await confirm('Include tool inputs/outputs (truncated to 2 KB each)?')));
  }
  cfg.binPath = BIN_PATH;
  saveConfig(paths, cfg);

  // 6. clients
  if (!reconnect) {
    const want = (flag(args, '--clients') ?? (yes ? 'claude,codex' : '')).split(',').filter((c) => c === 'claude' || c === 'codex') as ('claude' | 'codex')[];
    const chosen = want.length || flag(args, '--clients') === 'none' ? want
      : (await Promise.all((['claude', 'codex'] as const).map(async (c) => (await detectClient(c)) && (await confirm(`Configure ${c === 'claude' ? 'Claude Code' : 'Codex'} (MCP server, hooks, skill)?`)) ? c : null))).filter(Boolean) as ('claude' | 'codex')[];
    for (const c of chosen) {
      const r = await installClient(c, { binPath: BIN_PATH, skillSource: SKILL_SOURCE });
      cfg.clients[c] = { mcp: r.mcp, hooks: r.hooks, skill: r.skill, installedAt: new Date().toISOString() };
      out(`${c === 'claude' ? 'Claude Code' : 'Codex'}: hooks ${r.hooks ? 'ok' : 'FAILED'} · MCP ${r.mcp ? 'ok' : 'FAILED (' + r.mcpError + ')'} · skill ${r.skill ? 'ok' : 'FAILED'}`);
      if (c === 'codex') out('Codex: run /hooks inside Codex once to review and trust the tlon-memory hooks (they are skipped until trusted).');
    }
    saveConfig(paths, cfg);
  }

  // 7. probe: write a memory, read it back, delete it
  try {
    const store = new MemoryStore(paths, cfg);
    const p = await store.save({ type: 'context', text: `tlon-memory setup probe ${Date.now()}`, agent: 'claude-code', project: 'tlon-memory-setup' });
    const back = await store.search({ query: 'setup probe', project: 'tlon-memory-setup' });
    if (!back.some((h) => h.id === p.id)) throw new Error('probe memory not found after write');
    await client.deleteNote(cfg.notebook!.host, cfg.notebook!.name, p.id);
  } catch (e) { process.stderr.write(`Probe failed: ${(e as Error).message}\n`); return 1; }

  out(`\nConnected. Open ${noteUrl(cfg.shipUrl, cfg.notebook!, 0).replace(/\/n\/0$/, '')} to see your notebook.`);
  out(`Capture: ${cfg.paused ? 'paused' : cfg.scopes.length ? 'on for ' + cfg.scopes.join(', ') : 'off (no scope)'} · tool I/O: ${cfg.captureToolIo ? 'included (truncated)' : 'text only'}`);
  out(`\n${PRIVACY_NOTE}`);
  return 0;
}
