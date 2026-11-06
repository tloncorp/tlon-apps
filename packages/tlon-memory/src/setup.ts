// src/setup.ts
import { existsSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { UsageError, flag, has } from './cli-util';
import { Config, defaultConfig, loadConfig, saveConfig } from './config';
import { Client, detectClient, installClient } from './clients';
import { MemoryStore } from './memory';
import { ensureNotebook, notebookUrl } from './notebook';
import { NotesClient } from './notes-client';
import { Paths } from './paths';
import { ask, askHidden, confirm, readSecret } from './prompt';
import { markInitialized, resetBackoff } from './state';
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


const realOr = (p: string) => { try { return realpathSync(p); } catch { return p; } };

/** Why `dir` should not become a capture scope, or null. Home and / would upload every session on the machine. */
export function scopeProblem(dir: string, o: { force: boolean; mustExist: boolean }): string | null {
  const d = resolve(dir);
  if (o.mustExist && !(existsSync(d) && statSync(d).isDirectory())) return `${d} is not an existing directory`;
  if (!o.force && [realOr(homedir()), '/'].includes(realOr(d)))
    return `refusing scope ${d}: every Claude Code / Codex session started anywhere under it would be uploaded. Pick a project directory, or pass --force-scope if you mean it.`;
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

const CLIENT_NAMES: Record<Client, string> = { claude: 'Claude Code', codex: 'Codex' };

function parseClients(v: string | undefined): Client[] | undefined {
  if (v === undefined) return undefined;
  const list = v.split(',').map((c) => c.trim()).filter(Boolean);
  const bad = list.filter((c) => c !== 'claude' && c !== 'codex' && c !== 'none');
  if (bad.length) throw new UsageError(`--clients takes claude, codex or none; got ${bad.join(', ')}`);
  return list.filter((c): c is Client => c !== 'none');
}

export async function setup(args: string[]): Promise<number> {
  const paths = new Paths(); const yes = has(args, '--yes');
  const out = (s: string) => process.stdout.write(s + '\n');
  const err = (s: string) => process.stderr.write(s + '\n');
  const newAccount = has(args, '--new-account'); const reconnectFlag = has(args, '--reconnect'); const force = has(args, '--force-scope');
  const shipUrlArg = flag(args, '--ship-url'); const scopeArg = flag(args, '--scope'); const notebookArg = flag(args, '--notebook');
  const wanted = parseClients(flag(args, '--clients'));
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
    out(`A setup already exists (${existing.ship || existing.shipUrl}). Running setup again resets scopes and client settings; use --reconnect to replace only the key.`);
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
  cfg.ship = ship; cfg.apiKey = apiKey; saveConnection(paths, { state: 'ok', checkedAt: new Date().toISOString() }); markInitialized(paths);
  out(`\nConnected as ${cfg.ship}.`);
  if (reconnect) { const n = resetBackoff(paths); if (n) out(`${n} queued upload${n === 1 ? '' : 's'} will retry on the next sync.`); }

  // 4. notebook
  if (!reconnect) {
    const title = notebookArg ?? (yes ? 'Agent Memory' : await ask('Notebook title:', 'Agent Memory', '--notebook'));
    cfg.notebook = await ensureNotebook(client, title);
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
  cfg.binPath = BIN_PATH;
  saveConfig(paths, cfg);

  // 6. clients: one at a time, so prompts never overlap; one client's failure does not stop the other.
  const failures: string[] = [];
  if (!reconnect) {
    const chosen: Client[] = [];
    for (const c of wanted ?? (['claude', 'codex'] as const)) {
      if (!(await detectClient(c))) { if (wanted || yes) out(`${CLIENT_NAMES[c]}: \`${c}\` not found on PATH; skipped.`); continue; }
      if (wanted || yes || (await confirm(`Configure ${CLIENT_NAMES[c]} (MCP server, hooks, skill)?`, true, '--clients'))) chosen.push(c);
    }
    for (const c of chosen) {
      try {
        const r = await installClient(c, { binPath: BIN_PATH, skillSource: SKILL_SOURCE });
        cfg.clients[c] = { mcp: r.mcp, hooks: r.hooks, skill: r.skill, installedAt: new Date().toISOString() };
        out(`${CLIENT_NAMES[c]}: hooks ${r.hooks ? 'ok' : 'FAILED'} · MCP ${r.mcp ? 'ok' : 'FAILED (' + r.mcpError + ')'} · skill ${r.skill ? 'ok' : 'FAILED'}`);
        if (!r.mcp) failures.push(`${CLIENT_NAMES[c]}: MCP registration failed: ${r.mcpError}`);
        if (c === 'codex') out('Codex: run /hooks inside Codex once to review and trust the tlon-memory hooks (they are skipped until trusted).');
      } catch (e) { failures.push(`${CLIENT_NAMES[c]}: ${(e as Error).message}`); out(`${CLIENT_NAMES[c]}: FAILED (details below)`); }
    }
    saveConfig(paths, cfg);
  }

  // 7. probe: write a memory, read it back, delete it
  let probeId: number | undefined;
  try {
    const store = new MemoryStore(paths, cfg);
    const p = await store.save({ type: 'context', text: `tlon-memory setup probe ${Date.now()}`, agent: 'claude-code', project: 'tlon-memory-setup' });
    probeId = p.id;
    const back = await store.search({ query: 'setup probe', project: 'tlon-memory-setup' });
    if (!back.some((h) => h.id === p.id)) throw new Error('probe memory not found after write');
  } catch (e) {
    err(`Probe failed: ${(e as Error).message} (setup saved; run \`tlon-memory status\` to check the connection).`);
    for (const f of failures) err(f);
    return 1;
  } finally {
    if (probeId !== undefined) await client.deleteNote(cfg.notebook!.host, cfg.notebook!.name, probeId)
      .catch((e) => err(`Could not delete the setup probe note ${probeId}: ${(e as Error).message}`));
  }

  out(`\nConnected. Open ${notebookUrl(cfg.shipUrl, cfg.notebook!)} to see your notebook.`);
  out(`Capture: ${cfg.paused ? 'paused' : cfg.scopes.length ? 'on for ' + cfg.scopes.join(', ') : 'off (no scope)'} · tool I/O: ${cfg.captureToolIo ? 'included (truncated)' : 'text only'}`);
  out(`\n${PRIVACY_NOTE}`);
  if (failures.length) { err('\nSome client wiring failed:'); for (const f of failures) err(`  ${f}`); return 1; }
  return 0;
}
