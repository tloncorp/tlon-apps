// src/setup.ts
import { existsSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { UsageError, flag, has } from './cli-util';
import { Config, defaultConfig, loadConfig, saveConfig } from './config';
import { MemoryStore } from './memory';
import { ensureNotebook, notebookUrl } from './notebook';
import { NotesClient } from './notes-client';
import { Paths } from './paths';
import { ask, askHidden, confirm, readSecret } from './prompt';
import { markInitialized, resetBackoff } from './state';
import { saveConnection } from './status';
import { CLIENTS, CLIENT_NAMES, CODEX_TRUST_NOTE, installCommand, onPath } from './plugin';

export const SIGNUP_URL = 'https://tlon.network/signup?source=agent';
/**
 * The package directory (holding bin/, skills/, dist/). Run from source, it is one level above this file.
 * Inside a bun-compiled binary, import.meta.url points into bun's embedded filesystem (file:///$bunfs/...),
 * so the root is found from the binary's own path instead: <root>/dist/tlon-memory.
 */
export function packageRoot(execPath: string, importMetaUrl: string): string {
  const compiled = importMetaUrl.startsWith('file:///$bunfs/') || basename(execPath) === 'tlon-memory';
  return compiled ? dirname(dirname(execPath)) : resolve(dirname(fileURLToPath(importMetaUrl)), '..');
}
const realOr = (p: string) => { try { return realpathSync(p); } catch { return p; } };
/** The checkout the plugin is installed from. */
export const PLUGIN_ROOT = packageRoot(realOr(process.execPath), import.meta.url);

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


/**
 * Why `dir` should not become a capture scope, or null. Home, `/` and any directory that contains home (like
 * /Users) would upload every session on the machine. Compared by realpath, so a symlink cannot sneak past.
 */
export function scopeProblem(dir: string, o: { force: boolean; mustExist: boolean }): string | null {
  const d = resolve(dir);
  if (o.mustExist && !(existsSync(d) && statSync(d).isDirectory())) return `${d} is not an existing directory`;
  if (o.force) return null;
  const real = realOr(d), home = realOr(homedir());
  if (real === '/' || real === home || home.startsWith(real.endsWith(sep) ? real : real + sep))
    return `refusing scope ${d}: it is ${real === home ? 'your home directory' : real === '/' ? '/' : 'a parent of your home directory'}, so every Claude Code / Codex session started anywhere under it would be uploaded. Pick a project directory, or pass --force-scope if you mean it.`;
  return null;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** The ship's origin: a URL copied from the browser may carry a path. Plain http only for a local ship. */
export function normaliseShipUrl(raw: string): string {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { throw new UsageError(`not a URL: ${raw}`); }
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && LOCAL_HOSTS.has(u.hostname)))
    throw new UsageError(`ship URL must start with https:// (http:// only for localhost): ${raw}`);
  return u.origin;
}

/** The plugin carries the hooks, MCP server and skill; setup only says how to install it. */
function printInstall(out: (s: string) => void) {
  const found = CLIENTS.filter((c) => onPath(c));
  out(found.length ? '\nInstall the plugin (hooks, MCP server and skill):' : '\nNeither `claude` nor `codex` is on PATH. To install the plugin later:');
  for (const c of found.length ? found : CLIENTS) out(`  ${CLIENT_NAMES[c]}: ${installCommand(c)}`);
  if (!found.length || found.includes('codex')) out(CODEX_TRUST_NOTE);
  if (!existsSync(join(PLUGIN_ROOT, 'dist', 'tlon-memory.js'))) out(`Run \`pnpm build\` in ${PLUGIN_ROOT} first, so the hooks need only node.`);
}

export async function setup(args: string[]): Promise<number> {
  const paths = new Paths(); const yes = has(args, '--yes');
  const out = (s: string) => process.stdout.write(s + '\n');
  const err = (s: string) => process.stderr.write(s + '\n');
  const newAccount = has(args, '--new-account'); const reconnectFlag = has(args, '--reconnect'); const force = has(args, '--force-scope');
  const shipUrlArg = flag(args, '--ship-url'); const scopeArg = flag(args, '--scope'); const notebookArg = flag(args, '--notebook');
  const stdinKey = has(args, '--api-key-stdin'); const stdinCode = has(args, '--code-stdin');
  // With --yes nothing is prompted, so every required input must come from a flag; checked before any network call.
  if (yes && !newAccount) {
    if (!reconnectFlag && !shipUrlArg) throw new UsageError('--yes needs --ship-url (or --new-account / --reconnect)');
    if (!stdinKey && !stdinCode) throw new UsageError('--yes needs --api-key-stdin or --code-stdin');
    if (!reconnectFlag && scopeArg === undefined) throw new UsageError('--yes needs --scope DIR (or --scope none)');
  }
  if (scopeArg !== undefined && scopeArg !== 'none') { const p = scopeProblem(scopeArg, { force, mustExist: false }); if (p) throw new UsageError(p); }
  const shipUrlNorm = shipUrlArg !== undefined ? normaliseShipUrl(shipUrlArg) : undefined;

  const existing = loadConfig(paths);
  if (reconnectFlag && !existing) throw new UsageError('--reconnect needs an existing setup; run `tlon-memory setup` first');
  const reconnect = reconnectFlag && existing !== null;

  out(DISCLOSURE);
  if (!yes && !(await confirm('Continue?', true, '--yes'))) return 1;
  if (existing && !reconnect && !newAccount) {
    out(`A setup already exists (${existing.ship || existing.shipUrl}). Running setup again resets scopes; use --reconnect to replace only the key.`);
    if (!yes && !(await confirm('Start over?', false, '--yes'))) return 1;
  }
  const cfg: Config = reconnect ? existing! : defaultConfig();

  // 1. account
  if (!reconnect && (newAccount || (!shipUrlNorm && !(await confirm('Do you already have a Tlon account (a ship URL like https://sampel-palnet.tlon.network)?', true, '--ship-url'))))) {
    const browser = !process.env.TLON_MEMORY_NO_BROWSER;
    out(`\nCreate an account at ${SIGNUP_URL}${browser ? ' (opens in your browser)' : ''}; sign-up may require an invite or be capacity-limited.`);
    out('When you have your ship URL from the dashboard, re-run `tlon-memory setup`.');
    if (browser) {
      const { spawn } = await import('node:child_process');
      spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [SIGNUP_URL], { stdio: 'ignore', detached: true })
        .on('error', (e) => err(`Could not open a browser (${e.message}); open the link above yourself.`)).unref();
    }
    return 0;
  }
  if (!reconnect || shipUrlNorm) {
    cfg.shipUrl = shipUrlNorm ?? normaliseShipUrl(await ask('Ship URL:', '', '--ship-url'));
    out(`Ship URL: ${cfg.shipUrl}`);
  }

  // 2. credential (paste key, or +code once)
  let apiKey: string;
  if (stdinKey) apiKey = await readSecret('Notes API key:', '--api-key-stdin');
  else if (stdinCode) apiKey = await NotesClient.apiKeyFromCode(cfg.shipUrl, await readSecret('+code:', '--code-stdin')).catch((e) => { throw new Error(`could not fetch the API key with +code: ${e.message}`); });
  else {
    out('\nHow do you want to authorize?\n  1) paste your Notes API key\n  2) enter your +code once (used only to fetch the key, then discarded)');
    const choice = await ask('Choice:', '2', '--api-key-stdin or --code-stdin');
    if (choice === '1') apiKey = await askHidden('Notes API key:', '--api-key-stdin');
    else { const code = await askHidden('+code:', '--code-stdin'); apiKey = await NotesClient.apiKeyFromCode(cfg.shipUrl, code); }
  }
  if (!apiKey) { err('no API key provided'); return 1; }

  // 3. verify
  const client = new NotesClient({ shipUrl: cfg.shipUrl, apiKey });
  let ship: string;
  try { ship = await client.hostName(); await client.listNotebooks(); }
  catch (e) { err(`Could not connect: ${(e as Error).message}`); return 1; }
  if (reconnect && cfg.ship && ship !== cfg.ship) { err(`This key belongs to ${ship}, but the notebook is on ${cfg.ship}. Run setup without --reconnect to start over.`); return 1; }
  cfg.ship = ship; cfg.apiKey = apiKey; saveConnection(paths, { state: 'ok', checkedAt: new Date().toISOString() });
  out(`\nConnected as ${cfg.ship}.`);
  if (reconnect) { const n = resetBackoff(paths); if (n) out(`${n} queued upload${n === 1 ? '' : 's'} will retry on the next sync.`); }

  // 4. notebook
  if (!reconnect) {
    const title = notebookArg ?? (yes ? 'Agent Memory' : await ask('Notebook title:', 'Agent Memory', '--notebook'));
    const { created, ...notebook } = await ensureNotebook(client, title);
    cfg.notebook = notebook;
    // A new notebook holds no sessions, so later sessions need no recovery search. An adopted one may hold
    // this device's (or another's) sessions: leave the marker absent so the first sync looks before creating.
    if (created) markInitialized(paths);
    out(`Notebook "${title}" ready (${cfg.notebook.host}/${cfg.notebook.name}) with folders conversations/ and memories/.`);
    // 5. scope + tool I/O
    let scope = scopeArg;
    while (scope === undefined) {
      const a = await ask('Capture conversations started in which directory? ("none" for no capture)', process.cwd(), '--scope');
      const p = a === 'none' ? null : scopeProblem(a, { force, mustExist: false });
      if (p) err(p); else scope = a;
    }
    cfg.scopes = scope === 'none' ? [] : [resolve(scope)];
    cfg.captureToolIo = !has(args, '--no-tool-io') && (yes || (await confirm('Include tool inputs/outputs (truncated to 2 KB each)?', true, '--no-tool-io')));
  }
  saveConfig(paths, cfg);

  // 6. probe: write a memory, read it back, delete it
  let probeId: number | undefined;
  try {
    const store = new MemoryStore(paths, cfg);
    const p = await store.save({ type: 'context', text: `tlon-memory setup probe ${Date.now()}`, agent: 'claude-code', project: 'tlon-memory-setup' });
    probeId = p.id;
    const back = await store.search({ query: 'setup probe', project: 'tlon-memory-setup' });
    if (!back.some((h) => h.id === p.id)) throw new Error('probe memory not found after write');
  } catch (e) {
    err(`Probe failed: ${(e as Error).message} (setup saved; run \`tlon-memory status\` to check the connection).`);
    return 1;
  } finally {
    if (probeId !== undefined) await client.deleteNote(cfg.notebook!.host, cfg.notebook!.name, probeId)
      .catch((e) => err(`Could not delete the setup probe note ${probeId}: ${(e as Error).message}`));
  }

  out(`\nConnected. Open ${notebookUrl(cfg.shipUrl, cfg.notebook!)} to see your notebook.`);
  out(`Capture: ${cfg.paused ? 'paused' : cfg.scopes.length ? 'on for ' + cfg.scopes.join(', ') : 'off (no scope)'} · tool I/O: ${cfg.captureToolIo ? 'included (truncated)' : 'text only'}`);
  out(`\n${PRIVACY_NOTE}`);
  if (!reconnect) printInstall(out);
  return 0;
}
