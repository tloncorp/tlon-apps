import type { HeartbeatActivity } from './heartbeat-activity.js';
import type { HeartbeatPacketVersion } from './heartbeat-evidence.js';
import type { HeartbeatSkipBlock } from './heartbeat-skip.js';

export type HeartbeatRunEnded = {
  runId: string;
  modelCalls: number;
  toolCalls: number;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheWriteTokens: number | null;
  durationMs: number;
  success: boolean;
  packetBytes: number;
  packetVersion: HeartbeatPacketVersion;
  ledgerRecorded: boolean;
  selected: number;
  /** Why this tick ran instead of being skipped; null when not decided. */
  skipBlockedBy: HeartbeatSkipBlock | null;
  /** Ticks skipped between the previous real run and this one. */
  skippedTicksBefore: number;
};

export type HeartbeatRunSkipped = {
  runId: string;
  sinceLastRunMs: number;
  /** Ticks skipped since the last real run, this one included. */
  skippedTicks: number;
};

export type HeartbeatRunUsage = {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
};

export type HeartbeatRunObservation = {
  startedAt: number;
  modelCalls: number;
  toolCalls: number;
  usage?: HeartbeatRunUsage;
  ended?: true;
  /** Where the run's last-run record for skipping is kept and read. */
  skipKey?: string;
  workspaceDir?: string;
  requestedEvidenceVersion?: HeartbeatPacketVersion;
  evidence?: Promise<string[] | undefined>;
  activity?: Promise<HeartbeatActivity>;
  packetBytes?: number;
  packetVersion?: HeartbeatPacketVersion;
  /** The key of the watched activity the last packet gave the model. */
  handedActivityKey?: string;
};

export function accumulateHeartbeatUsage(
  run: HeartbeatRunObservation,
  usage: HeartbeatRunUsage
): void {
  const totals = (run.usage ??= {});
  for (const field of ['input', 'output', 'cacheRead', 'cacheWrite'] as const) {
    const tokens = usage[field];
    if (tokens !== undefined) totals[field] = (totals[field] ?? 0) + tokens;
  }
}
