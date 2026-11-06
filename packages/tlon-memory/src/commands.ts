// src/commands.ts
import { existsSync, mkdirSync, readdirSync, rmSync, rmdirSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { UsageError, flag, has, safeName } from './cli-util';
import { Client, uninstallClient } from './clients';
import { Config, loadConfig, requireConfig, saveConfig } from './config';
import { MEMORY_SCAN, MemoryStore } from './memory';
import { NotesClient, NotesError, SEARCH_HORIZON_NOTE } from './notes-client';
import { Paths, writePrivate } from './paths';
import { askHidden, confirm } from './prompt';
import { parseFrontMatter } from './render';
import { deleteAllPendingLinks, deleteSessionState, listJobs, listSessionStates, queueFile, savePendingLinks } from './state';
import { loadConnection, statusLine } from './status';
import { syncQueue } from './sync';
import { BIN_PATH, SKILL_SOURCE, scopeProblem } from './setup';

const out = (s: string) => process.stdout.write(s + '\n');
const err = (s: string) => process.stderr.write(s + '\n');
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const CLIENTS: Client[] = ['claude', 'codex'];
const SESSION_CLIENT = { 'claude-code': 'claude', codex: 'codex' } as const;

export async function command(cmd: string, args: string[]): Promise<number> {
  const paths = new Paths();
  // disconnect must work when the config is missing or unreadable, so it runs before requireConfig.
  if (cmd === 'disconnect') return disconnect(paths, args);
  const cfg = requireConfig(paths);
  const client = new NotesClient({ shipUrl: cfg.shipUrl, apiKey: cfg.apiKey });
  const nb = cfg.notebook!;
  switch (cmd) {
    case 'status': {
      const jobs = listJobs(paths);
      const conversations = listSessionStates(paths).filter((s) => s.noteIds[0] != null).length;
      let counts: string;
      try {
        const scan = await new MemoryStore(paths, cfg).memoryScan(); const m = scan.notes.length;
        counts = `memories: ${m >= MEMORY_SCAN ? `${MEMORY_SCAN}+` : m}${scan.truncated ? ` (scan truncated: older notes not searched)` : ''}`;
      }
      catch (e) {
        const why = !(e instanceof NotesError) ? msg(e) : e.code === 'key-rejected' ? `key rejected: ${e.message}`
          : e.code === 'unreachable' ? `ship unreachable: ${e.message}` : `${e.code}: ${e.message}`;
        counts = `memories: unknown (${why})`;
      }
      counts += ` · conversations synced from this device: ${conversations}`;
      const conn = loadConnection(paths);
      out(statusLine(cfg, conn, process.cwd(), jobs.length));
      out(`ship: ${cfg.ship} (${cfg.shipUrl}) · notebook: ${nb.host}/${nb.name} · ${counts}`);
      out(`scopes: ${cfg.scopes.join(', ') || '(none)'} · tool I/O: ${cfg.captureToolIo ? 'included' : 'off'} · clients: ${Object.keys(cfg.clients).join(', ') || 'none'}`);
      for (const j of jobs) out(`  pending: ${j.client} ${j.sessionId} attempts=${j.attempts}${j.lastError ? ' last error: ' + j.lastError : ''}`);
      out(`${SEARCH_HORIZON_NOTE}.`);
      if (conn.state !== 'ok') out(`connection: ${conn.state}${conn.lastError ? ' — ' + conn.lastError : ''}`);
      return 0;
    }
    case 'pause': cfg.paused = true; saveConfig(paths, cfg); out('Capture paused. Sessions are not uploaded until `tlon-memory resume`.'); return 0;
    case 'resume': cfg.paused = false; saveConfig(paths, cfg); out('Capture resumed.'); return 0;
    case 'scope': {
      const [sub, dir] = args;
      if (sub === 'add' && dir) {
        const problem = scopeProblem(dir, { force: has(args, '--force-scope'), mustExist: true });
        if (problem) throw new UsageError(problem);
        const d = resolve(dir); if (!cfg.scopes.includes(d)) cfg.scopes.push(d); saveConfig(paths, cfg); out(`Capture on for ${d}`); return 0;
      }
      if (sub === 'remove' && dir) { const d = resolve(dir); cfg.scopes = cfg.scopes.filter((s) => s !== d); saveConfig(paths, cfg); out(`Capture off for ${d}`); return 0; }
      if (sub && sub !== 'list') throw new UsageError('usage: scope add|remove DIR | scope list');
      out(cfg.scopes.join('\n') || '(no scopes: nothing is captured)'); return 0;
    }
    case 'sync': {
      const r = await syncQueue(paths, cfg, { budgetMs: 120_000, ignoreBackoff: true });
      if (r.locked) { out(`another sync is running; ${r.remaining} job${r.remaining === 1 ? '' : 's'} queued`); return 0; }
      out(`synced ${r.synced}, failed ${r.failed}, remaining ${r.remaining}${r.lastError ? ' — ' + r.lastError : ''}`); return r.failed ? 1 : 0;
    }
    case 'export': return exportNotes(paths, cfg, client, args);
    case 'delete': return deleteNotes(paths, cfg, client, args);
    case 'import': return (await import('./import')).importCommand(paths, cfg, args);
    default: return 2;
  }
}

async function exportNotes(paths: Paths, cfg: Config, client: NotesClient, args: string[]): Promise<number> {
  const nb = cfg.notebook!;
  const dir = resolve(flag(args, '--out') ?? join(homedir(), `tlon-memory-export-${new Date().toISOString().slice(0, 10)}`));
  for (const d of [dir, join(dir, 'conversations'), join(dir, 'memories')]) mkdirSync(d, { recursive: true, mode: 0o700 });
  const notes = (await client.listNotes(nb.host, nb.name)).filter((n) => n.folderId === nb.conversationsFolderId || n.folderId === nb.memoriesFolderId);
  const index = notes.map((n) => {
    const kind = n.folderId === nb.memoriesFolderId ? 'memories' : 'conversations';
    const file = join(dir, kind, `${n.id}-${safeName(n.title).slice(0, 100)}.md`); writePrivate(file, n.bodyMd);
    return { id: n.id, kind, title: n.title, file, revision: n.revision, updatedAt: n.updatedAt, session_key: parseFrontMatter(n.bodyMd).fields.session_key };
  });
  writePrivate(join(dir, 'index.json'), JSON.stringify({ exportedAt: new Date().toISOString(), ship: cfg.ship, notebook: `${nb.host}/${nb.name}`, notes: index }, null, 2));
  out(`Exported ${index.length} notes to ${dir}`);
  out('Transcripts may contain sensitive text (code, paths, anything pasted into a session); the files are readable only by you. Keep the export private.');
  return 0;
}

async function deleteNotes(paths: Paths, cfg: Config, client: NotesClient, args: string[]): Promise<number> {
  const nb = cfg.notebook!;
  const session = flag(args, '--session'); const memory = flag(args, '--memory'); const all = has(args, '--all');
  if (!session && !memory && !all) throw new UsageError('delete needs --session KEY | --memory ID | --all');
  if (memory !== undefined && !/^[1-9]\d*$/.test(memory)) throw new UsageError(`--memory needs a note id (a positive integer), got ${memory}`);
  let sessionRef: { client: Client; key: keyof typeof SESSION_CLIENT; id: string } | undefined;
  if (session !== undefined) {
    const [c, ...rest] = session.split(':'); const id = rest.join(':');
    if ((c !== 'claude-code' && c !== 'codex') || !id) throw new UsageError(`--session needs claude-code:ID or codex:ID, got ${session}`);
    sessionRef = { client: SESSION_CLIENT[c], key: c, id };
  }
  if (!has(args, '--yes') && !(process.stdin.isTTY && (await confirm('This removes notes from your ship (their revision history goes with them). Continue?', false, '--yes')))) {
    err('aborted (pass --yes to skip the prompt)'); return 1;
  }
  let n = 0;
  const del = async (id: number) => { await client.deleteNote(nb.host, nb.name, id); n++; };
  if (memory) {
    const note = await client.getNote(nb.host, nb.name, Number(memory));
    if (note.folderId !== nb.memoriesFolderId) { err(`note ${memory} is not a memory (it is not in the memories folder); nothing deleted`); return 1; }
    await del(note.id);
  }
  if (sessionRef || all) {
    const notes = await client.listNotes(nb.host, nb.name);
    for (const note of notes) {
      const conv = note.folderId === nb.conversationsFolderId;
      if (all ? conv || note.folderId === nb.memoriesFolderId : conv && parseFrontMatter(note.bodyMd).fields.session_key === session) await del(note.id);
    }
  }
  // Remove local state and queued uploads too, or the next sync would re-create the deleted notes.
  if (sessionRef) {
    deleteSessionState(paths, sessionRef.key, sessionRef.id);
    savePendingLinks(paths, sessionRef.key, sessionRef.id, []);
    const f = queueFile(paths, { client: sessionRef.client, sessionId: sessionRef.id }); if (existsSync(f)) unlinkSync(f);
  }
  if (all) {
    for (const s of listSessionStates(paths)) deleteSessionState(paths, s.client, s.sessionId);
    deleteAllPendingLinks(paths);
    for (const j of listJobs(paths)) { const f = queueFile(paths, j); if (existsSync(f)) unlinkSync(f); }
  }
  out(`Deleted ${n} note${n === 1 ? '' : 's'}. Not affected: copies already sent to a model provider, other devices' queues, Tlon hosting backups.`);
  if (sessionRef || all) out('If a deleted session is still running, pause capture first (`tlon-memory pause`), or its next hook uploads it again.');
  return 0;
}

/** Files and directories under the root that tlon-memory creates; anything else there is left alone. */
const OWNED = ['config.json', 'state', 'queue', 'log'];

function removeOwned(paths: Paths): string {
  if (!existsSync(paths.root)) return 'No local config, state or queue to remove.';
  for (const f of OWNED) rmSync(join(paths.root, f), { recursive: true, force: true });
  for (const f of readdirSync(paths.root)) if (f.includes('.tmp-')) rmSync(join(paths.root, f), { force: true });
  const left = readdirSync(paths.root);
  if (left.length) return `Local config, state and queue removed. ${paths.root} was kept because it holds other files (${left.slice(0, 3).join(', ')}${left.length > 3 ? ', …' : ''}).`;
  rmdirSync(paths.root);
  return 'Local config, state and queue removed.';
}

async function disconnect(paths: Paths, args: string[]): Promise<number> {
  let cfg: Config | null = null;
  try { cfg = loadConfig(paths); } catch (e) { out(`Config unreadable (${msg(e)}); removing what can be found anyway.`); }
  if (has(args, '--revoke-key')) {
    // Rotate first: if this fails the user still has a working setup to retry from.
    if (!cfg?.shipUrl) { err('--revoke-key needs the ship URL from config.json, which is missing or unreadable. Nothing was removed.'); return 1; }
    try {
      const key = await NotesClient.regenerateWithCode(cfg.shipUrl, await askHidden('+code (to rotate the Notes API key):'));
      if (key === cfg.apiKey) throw new Error('the ship returned the same key');
    } catch (e) { err(`Could not rotate the Notes API key: ${msg(e)}. Nothing was removed.`); return 1; }
    out('Notes API key rotated on the ship; the stored key no longer works.');
  }
  let failed = false;
  // Both clients, whatever the config says: uninstall is idempotent and the config may be stale or gone.
  for (const c of CLIENTS) {
    try {
      const r = await uninstallClient(c, { binPath: BIN_PATH, skillSource: SKILL_SOURCE });
      const mcp = r.mcpNotFound ? 'MCP server was not registered' : r.mcp.code === 0 ? 'MCP server removed'
        : `MCP remove exited ${r.mcp.code}: ${(r.mcp.err || r.mcp.out).trim().slice(0, 300)}`;
      if (r.mcp.code !== 0 && !r.mcpNotFound) failed = true;
      const local = r.hooks && r.skill ? 'hooks and skill removed' : r.hooks ? 'hooks removed, no skill to remove'
        : r.skill ? 'skill removed, no hooks to remove' : 'no hooks or skill to remove';
      out(`${c}: ${local} · ${mcp}`);
      if (c === 'codex' && r.shifted) out('codex: run /hooks in Codex to re-trust any remaining hooks (their positions changed).');
    } catch (e) { failed = true; out(`${c}: could not remove wiring: ${msg(e)}`); }
  }
  out(removeOwned(paths));
  out('Notes on your ship were kept; use `export`/`delete` before disconnecting if you want them gone.');
  return failed ? 1 : 0;
}
