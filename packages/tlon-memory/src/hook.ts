// src/hook.ts
import { readStdin } from './cli-util';
import { Config, isInScope, loadConfig } from './config';
import { appendLog } from './log';
import { Paths } from './paths';
import { listJobs } from './state';
import { loadConnection, statusLine } from './status';
import { clientId, enqueue, syncQueue } from './sync';

type Client = 'claude' | 'codex';
interface Payload { session_id?: string; transcript_path?: string | null; cwd?: string; hook_event_name?: string; reason?: string }

export const DEFAULT_BUDGET_MS = 15_000;
export function budgetFromEnv(v = process.env.TLON_MEMORY_SYNC_BUDGET_MS): number {
  const n = Number(v);
  return v !== undefined && v.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : DEFAULT_BUDGET_MS;
}

const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

/** `tlon-memory hook <claude|codex>`: always exits 0; only SessionStart prints. Never writes config.json. */
export async function hook(args: string[]): Promise<number> {
  const client = args[0] as Client;
  if (client !== 'claude' && client !== 'codex') return 0;
  const paths = new Paths();
  let event = '';
  try {
    let cfg: Config | null;
    try { cfg = loadConfig(paths); }
    catch (e) { appendLog(paths, 'hook-config-unreadable', { client, error: (e as Error).message }); return 0; }
    if (!cfg || !cfg.apiKey || !cfg.notebook || !cfg.clients[client]) return 0;
    let p: Payload;
    try { p = JSON.parse(await readStdin()); } catch { return 0; }
    if (!p || typeof p !== 'object') return 0;
    const cwd = str(p.cwd) ?? process.cwd();
    event = str(p.hook_event_name) ?? '';
    const sessionId = str(p.session_id), transcript = str(p.transcript_path);
    if (event === 'SessionStart') {
      const key = sessionId ? `${clientId(client)}:${sessionId}` : undefined;
      process.stdout.write(statusLine(cfg, loadConnection(paths), cwd, listJobs(paths).length, key) + '\n');
      return 0;
    }
    if (event !== 'Stop' && event !== 'SessionEnd') return 0;
    if (cfg.paused || !isInScope(cfg, cwd) || !sessionId || !transcript) return 0;
    enqueue(paths, { client, sessionId, transcriptPath: transcript, cwd });
    appendLog(paths, 'enqueue', { client, session: sessionId, event });
    // SessionEnd is advisory and (Codex) capped at 3 s: enqueue only. Stop gets a 15 s inline budget.
    if (event === 'Stop') await syncQueue(paths, cfg, { budgetMs: budgetFromEnv() });
  } catch (e) {
    appendLog(paths, 'hook-error', { client, event, error: (e as Error).message });
  }
  return 0;
}
