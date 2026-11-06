// src/import.ts
// Upload conversations the hooks never saw: ones from before setup, or from a client whose hooks are not trusted yet.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { UsageError, flag, has } from './cli-util';
import { ClientName, Config, isInScope } from './config';
import { noteUrl } from './notebook';
import { Paths } from './paths';
import { renderConversation, sessionKey } from './render';
import { listJobs, loadJob, loadSessionState } from './state';
import { SyncReport, clientId, enqueue, parseTranscript, syncQueue } from './sync';
import { SESSION_KEY, clientOfKey, detectClient, findTranscript, listTranscripts, peekTranscript } from './transcripts';

/** What an import needs of a transcript. `--all` holds one per session, so never the parsed transcript itself. */
export interface Prepared { client: ClientName; path: string; sessionId: string; cwd: string; events: number; parts?: number }
export interface Outcome { key: string; kind: 'uploaded' | 'unchanged' | 'failed' | 'remaining'; parts?: number; url?: string; error?: string }

export const PAUSED = 'Capture is paused; run tlon-memory resume first.';
const ALL_BUDGET_MS = 600_000;
export const SINGLE_BUDGET_MS = 120_000;
/** Under Codex's default 60 s MCP tool timeout; the MCP server answers nothing else while a tool runs. */
export const TOOL_BUDGET_MS = 45_000;
const PROGRESS_EVERY = 25;

/** `withParts` renders the conversation to count its notes, for --dry-run only. */
export function prepare(cfg: Config, client: ClientName, path: string, withParts = false): Prepared {
  const t = parseTranscript(client, path, cfg.captureToolIo, [cfg.apiKey]);
  return { client, path, sessionId: t.sessionId, cwd: t.cwd, events: t.events.length, ...(withParts ? { parts: renderConversation(t).length } : {}) };
}
export const keyOf = (p: Pick<Prepared, 'client' | 'sessionId'>) => sessionKey({ client: clientId(p.client), sessionId: p.sessionId });
export const inScope = (cfg: Config, cwd: string) => cwd !== '' && isInScope(cfg, cwd);
export const outOfScope = (cfg: Config, p: Prepared) =>
  `${keyOf(p)} (${p.cwd || 'no directory recorded'}) is outside the capture scope (${cfg.scopes.join(', ') || 'none'}); add it with tlon-memory scope add`;

/** Queue the sessions and sync until they are done, a run makes no progress, or `budgetMs` (for the whole call) runs out. */
export async function importSessions(paths: Paths, cfg: Config, list: Prepared[], budgetMs: number): Promise<{ outcomes: Outcome[]; locked: boolean }> {
  const before = list.map(({ client, path, sessionId, cwd }) => {
    enqueue(paths, { client, sessionId, transcriptPath: path, cwd });
    return { attempts: loadJob(paths, { client, sessionId })!.attempts, synced: loadSessionState(paths, clientId(client), sessionId)?.lastSynced };
  });
  const queued = () => list.filter((p) => loadJob(paths, p)).length;
  const deadline = Date.now() + budgetMs;
  let locked = false;
  const dropped: SyncReport['dropped'] = [];
  for (let left = budgetMs; left > 0; left = deadline - Date.now()) {
    const r = await syncQueue(paths, cfg, { budgetMs: left, ignoreBackoff: true });
    if (r.locked) { locked = true; break; }
    dropped.push(...r.dropped);
    if (!queued() || !r.synced) break;
  }
  const outcomes = list.map((p, i): Outcome => {
    const key = keyOf(p);
    const job = loadJob(paths, p);
    if (job) return job.attempts > before[i].attempts ? { key, kind: 'failed', error: job.lastError } : { key, kind: 'remaining' };
    const drop = dropped.find((d) => d.client === p.client && d.sessionId === p.sessionId);
    if (drop) return { key, kind: 'failed', error: drop.reason };
    const st = loadSessionState(paths, clientId(p.client), p.sessionId)!;
    return { key, kind: st.lastSynced === before[i].synced ? 'unchanged' : 'uploaded', parts: st.noteIds.length, url: noteUrl(cfg.shipUrl, cfg.notebook!, st.noteIds[0]) };
  });
  return { outcomes, locked };
}

const out = (s: string) => process.stdout.write(s + '\n');
const err = (s: string) => process.stderr.write(s + '\n');

/** `tlon-memory import <file> | --session KEY | --all [--dry-run]` */
export async function importCommand(paths: Paths, cfg: Config, args: string[]): Promise<number> {
  const all = has(args, '--all'), dryRun = has(args, '--dry-run'), session = flag(args, '--session');
  const file = args.find((a) => !a.startsWith('--') && a !== session);
  if (Number(all) + Number(session !== undefined) + Number(file !== undefined) !== 1) throw new UsageError('import needs one of: <transcript.jsonl> | --session KEY | --all');
  if (cfg.paused) { err(PAUSED); return 1; }

  let list: Prepared[] = [];
  const empty: string[] = [];
  if (all) {
    const files = listTranscripts();
    files.forEach(({ client, path }, i) => {
      if ((i + 1) % PROGRESS_EVERY === 0) err(`scanned ${i + 1}/${files.length}`);
      const peek = peekTranscript(client, path);
      // The peek sees a Claude session's first cwd, the scope check needs its last: a session that moved into
      // a scope after starting outside it is missed here. `import <path>` uploads it.
      if (peek && !inScope(cfg, peek.cwd)) return;
      const p = prepare(cfg, client, path, dryRun);
      // An empty transcript records no cwd of its own; list it only when the peek placed it in scope.
      if (!p.events) { if (peek) empty.push(keyOf({ client, sessionId: p.sessionId || peek.sessionId })); return; }
      if (p.sessionId && inScope(cfg, p.cwd)) list.push(p);
    });
  } else {
    let client: ClientName, path: string;
    if (session !== undefined) {
      if (!SESSION_KEY.test(session)) throw new UsageError(`--session needs claude-code:ID or codex:ID, got ${session}`);
      const found = findTranscript(session);
      if (!found) { err(`no transcript for ${session} on this device`); return 1; }
      client = clientOfKey(session); path = found;
    } else {
      path = resolve(file!);
      if (!existsSync(path)) throw new UsageError(`no such file: ${path}`);
      client = detectClient(path);
    }
    const p = prepare(cfg, client, path, dryRun);
    if (!p.events) { out(`${path}: no conversation to upload`); return 0; }
    if (!p.sessionId) { err(`${path} has no session id`); return 1; }
    if (!inScope(cfg, p.cwd)) { err(outOfScope(cfg, p)); return 1; }
    list = [p];
  }

  if (dryRun) {
    for (const p of list) out(`${keyOf(p)}  ${p.cwd}  ${p.events} events  ${p.parts} part(s)`);
    for (const k of empty) out(`${k}  empty`);
    out(`${list.length} to upload, ${empty.length} empty`);
    return 0;
  }
  const { outcomes, locked } = await importSessions(paths, cfg, list, all ? ALL_BUDGET_MS : SINGLE_BUDGET_MS);
  const n = (k: Outcome['kind']) => outcomes.filter((o) => o.kind === k).length;
  for (const o of outcomes) out(`${o.key} → ${o.kind === 'uploaded' ? `${o.parts} part(s) ${o.url}` : o.kind === 'failed' ? `failed: ${o.error}` : o.kind === 'remaining' ? 'queued' : 'unchanged'}`);
  out(`synced ${n('uploaded')}, unchanged ${n('unchanged')}, failed ${n('failed')}, remaining ${n('remaining')}${empty.length ? `, ${empty.length} empty skipped` : ''}`);
  if (n('remaining')) out(`${locked ? 'another sync is running; ' : ''}${listJobs(paths).length} remaining; run tlon-memory sync to continue`);
  return n('failed') ? 1 : 0;
}
