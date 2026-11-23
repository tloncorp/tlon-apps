import { createHash } from 'node:crypto';
import path from 'node:path';

import type { HeartbeatActivity } from './heartbeat-activity.js';
import { memoryDates, readDailyNote } from './heartbeat-evidence.js';
import { readHeartbeatWorkspaceFile } from './heartbeat-ledger.js';
import { sharedMap, sharedSlot } from './shared-state.js';

export const HEARTBEAT_SKIP_DECLARATION =
  '<!-- tlon-uses: heartbeat-skip-v1 -->';
/** A real run happens at least this often, whatever else is unchanged. */
export const HEARTBEAT_SKIP_MAX_MS = 6 * 60 * 60 * 1000;

/** Why a heartbeat tick ran instead of being skipped. */
export type HeartbeatSkipBlock =
  | 'disabled'
  | 'not_plain_tick'
  | 'no_previous_run'
  | 'previous_run_not_quiet'
  | 'max_interval'
  | 'owner_message'
  | 'owner_message_unknown'
  | 'files_changed'
  | 'files_unknown'
  | 'activity_changed'
  | 'activity_unknown'
  | 'error';

/**
 * The last real scheduled heartbeat run in a workspace. Kept in memory only:
 * after a restart there is no record, so the next tick runs.
 */
export type HeartbeatLastRun = {
  /** When the run's skip check began, before it read anything. */
  checkedAt: number;
  endedAt: number;
  /** The run succeeded, recorded its ledger submission, and left nothing open. */
  quiet: boolean;
  /** The watched files when the run ended, after its own writes. */
  filesKey?: string;
  /** The mentions and replies its packet gave the model, if it gave them. */
  activityKey?: string;
  skippedTicks: number;
};

/** What a tick decided before its run started, for the run's own report. */
export type HeartbeatTick = {
  blockedBy: HeartbeatSkipBlock;
  checkedAt: number;
  skippedTicksBefore: number;
  activity?: Promise<HeartbeatActivity>;
};

const TICK_LIMIT = 16;
const lastRuns = sharedMap<string, HeartbeatLastRun>(
  'heartbeat-skip.last-runs'
);
const ticks = sharedMap<string, HeartbeatTick>('heartbeat-skip.ticks');
const ownerMessageReader = sharedSlot<() => number | undefined>(
  'heartbeat-skip.owner-message-reader'
);

/** When the owner last messaged the bot: 0 for never, undefined for unknown. */
export function setHeartbeatOwnerMessageReader(
  reader: (() => number | undefined) | null
): void {
  ownerMessageReader.set(reader);
}

export function readHeartbeatOwnerMessageAt(): number | undefined {
  return ownerMessageReader.get()?.();
}

export function getHeartbeatLastRun(
  workspaceDir: string
): HeartbeatLastRun | undefined {
  return lastRuns.get(workspaceDir);
}

export function setHeartbeatLastRun(
  workspaceDir: string,
  run: HeartbeatLastRun
): void {
  lastRuns.set(workspaceDir, run);
}

export function noteHeartbeatTick(runId: string, tick: HeartbeatTick): void {
  ticks.delete(runId);
  ticks.set(runId, tick);
  // A tick whose run is never recognised as a heartbeat is not taken back.
  for (const stale of ticks.keys()) {
    if (ticks.size <= TICK_LIMIT) break;
    ticks.delete(stale);
  }
}

export function getHeartbeatTick(
  runId: string | undefined
): HeartbeatTick | undefined {
  return runId ? ticks.get(runId) : undefined;
}

export function takeHeartbeatTick(runId: string): HeartbeatTick | undefined {
  const tick = ticks.get(runId);
  ticks.delete(runId);
  return tick;
}

export function heartbeatSkipRequested(configuredPrompt: string): boolean {
  return configuredPrompt.split(/\r?\n/).includes(HEARTBEAT_SKIP_DECLARATION);
}

// Core appends this block to every heartbeat prompt.
const CURRENT_TIME_BLOCK = /^Current time: [^\n]*\nReference UTC: [^\n]*$/;

/**
 * Whether the run's prompt is the configured heartbeat prompt and nothing
 * else. Core builds its own prompt for an exec completion or a cron event,
 * and adds queued events and monitor scratch to this one, so a wake that
 * carries work never matches. Nor does a tick in heartbeat_respond mode
 * (`messages.visibleReplies: "message_tool"`, or the Codex harness), where
 * core adds its own instructions: those ticks always run.
 */
export function isPlainHeartbeatTick(
  body: string,
  configuredPrompt: string
): boolean {
  const prompt = configuredPrompt.trimEnd();
  if (!prompt || !body.startsWith(prompt)) return false;
  const rest = body.slice(prompt.length).trim();
  return rest === '' || CURRENT_TIME_BLOCK.test(rest);
}

/** Identifies the files another writer could change between two ticks. */
export async function heartbeatFilesKey(opts: {
  workspaceDir: string;
  timezone: string;
  now?: Date;
}): Promise<string> {
  const files = ['PROACTIVE_PREFERENCES.md', 'MEMORY.md'];
  const notes = memoryDates(opts.now ?? new Date(), opts.timezone).map(
    (date) => `memory/${date}.md`
  );
  const contents = await Promise.all([
    ...files.map((name) =>
      readHeartbeatWorkspaceFile(path.join(opts.workspaceDir, name))
    ),
    ...notes.map((name) => readDailyNote(opts.workspaceDir, name)),
  ]);
  return createHash('sha256')
    .update(
      JSON.stringify([...files, ...notes].map((name, i) => [name, contents[i]]))
    )
    .digest('hex');
}

export type HeartbeatSkipDecision =
  | { skip: true; sinceLastRunMs: number }
  | { skip: false; blockedBy: HeartbeatSkipBlock };

/**
 * Skip only when every check positively shows nothing changed. A missing
 * value on either side counts as a change, so an error runs the heartbeat.
 */
export function decideHeartbeatSkip(opts: {
  lastRun: HeartbeatLastRun | undefined;
  now: number;
  ownerMessageAt: number | undefined;
  filesKey: string | undefined;
  activityKey: string | undefined;
}): HeartbeatSkipDecision {
  const { lastRun } = opts;
  const blocked = (blockedBy: HeartbeatSkipBlock) =>
    ({ skip: false, blockedBy }) as const;
  if (!lastRun) return blocked('no_previous_run');
  if (!lastRun.quiet) return blocked('previous_run_not_quiet');
  const sinceLastRunMs = opts.now - lastRun.endedAt;
  if (sinceLastRunMs < 0 || sinceLastRunMs >= HEARTBEAT_SKIP_MAX_MS) {
    return blocked('max_interval');
  }
  if (opts.ownerMessageAt === undefined) {
    return blocked('owner_message_unknown');
  }
  // A message that arrived once the run had begun was not part of it.
  if (opts.ownerMessageAt >= lastRun.checkedAt) return blocked('owner_message');
  if (opts.filesKey === undefined || lastRun.filesKey === undefined) {
    return blocked('files_unknown');
  }
  if (opts.filesKey !== lastRun.filesKey) return blocked('files_changed');
  if (opts.activityKey === undefined || lastRun.activityKey === undefined) {
    return blocked('activity_unknown');
  }
  if (opts.activityKey !== lastRun.activityKey) {
    return blocked('activity_changed');
  }
  return { skip: true, sinceLastRunMs };
}

export const _testing = {
  clearAll(): void {
    lastRuns.clear();
    ticks.clear();
  },
};
