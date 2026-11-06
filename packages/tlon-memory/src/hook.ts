// src/hook.ts
import { Config, isInScope, loadConfig } from './config';
import { appendLog } from './log';
import { Paths } from './paths';
import { listJobs } from './state';
import { clientId, enqueue, syncQueue } from './sync';

type Client = 'claude' | 'codex';
interface Payload { session_id?: string; transcript_path?: string | null; cwd?: string; hook_event_name?: string; reason?: string }

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks).toString('utf8');
}

export function statusLine(cfg: Config, cwd: string, pending: number, sessionKey?: string): string {
  const scope = cfg.paused ? 'capture PAUSED' : isInScope(cfg, cwd) ? `capture ON for ${cwd}` : `capture OFF for ${cwd} (not in scope)`;
  const conn = cfg.connection.state === 'key-rejected' ? 'KEY REJECTED — run `tlon-memory setup --reconnect`'
    : cfg.connection.state === 'unreachable' ? `ship unreachable (${cfg.connection.lastError ?? 'unknown'})` : `connected as ${cfg.ship}`;
  return `Tlon memory: ${conn} · notebook "${cfg.notebook?.title ?? '-'}" · ${scope} · ${pending} pending sync${pending === 1 ? '' : 's'}`
    + (sessionKey ? ` · session ${sessionKey}` : '');
}

/** `tlon-memory hook <claude|codex>`: always exits 0; only SessionStart prints. */
export async function hook(args: string[]): Promise<number> {
  const client = args[0] as Client;
  if (client !== 'claude' && client !== 'codex') return 0;
  const paths = new Paths();
  const cfg = loadConfig(paths);
  if (!cfg || !cfg.apiKey || !cfg.notebook || !cfg.clients[client]) return 0;
  let p: Payload = {};
  try { p = JSON.parse(await readStdin()); } catch { return 0; }
  const cwd = p.cwd ?? process.cwd();
  const event = p.hook_event_name ?? '';
  try {
    if (event === 'SessionStart') {
      const key = p.session_id ? `${clientId(client)}:${p.session_id}` : undefined;
      process.stdout.write(statusLine(cfg, cwd, listJobs(paths).length, key) + '\n');
      return 0;
    }
    if (event !== 'Stop' && event !== 'SessionEnd') return 0;
    if (cfg.paused || !isInScope(cfg, cwd) || !p.session_id || !p.transcript_path) return 0;
    enqueue(paths, { client, sessionId: p.session_id, transcriptPath: p.transcript_path, cwd });
    appendLog(paths, 'enqueue', { client, session: p.session_id, event });
    // SessionEnd is advisory and (Codex) capped at 3 s: enqueue only. Stop gets a 15 s inline budget.
    if (event === 'Stop') await syncQueue(paths, cfg, { budgetMs: Number(process.env.TLON_MEMORY_SYNC_BUDGET_MS ?? 15_000) });
  } catch (e) {
    appendLog(paths, 'hook-error', { client, event, error: (e as Error).message });
  }
  return 0;
}
