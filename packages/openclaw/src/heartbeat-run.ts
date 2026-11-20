import type { HeartbeatActivity } from './heartbeat-activity.js';
import type { HeartbeatPacketVersion } from './heartbeat-evidence.js';

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
  requestedEvidenceVersion?: HeartbeatPacketVersion;
  evidence?: Promise<string[] | undefined>;
  activity?: Promise<HeartbeatActivity>;
  packetBytes?: number;
  packetVersion?: HeartbeatPacketVersion;
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
