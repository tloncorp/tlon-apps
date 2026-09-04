import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';

import type { TlonLifecycleConfig } from '../types.js';

/**
 * Mirrors `DEFAULT_TLON_RUN_TIMEOUT_MS` in tlonbot's `entrypoint/tlawn.py`,
 * which is the deployed value: that entrypoint WRITES `runTimeoutMs` into the
 * config (migrating anything still on its `PREVIOUS_TLON_RUN_TIMEOUT_MS` of
 * 120s/240s), so a hosted bot never reaches this default at all.
 *
 * Anything that does not run that migration does — the dev container sets the
 * key nowhere, so this constant alone decided its budget. It was 120_000 while
 * production ran 300_000, and nothing connected the two: Session 6a measured a
 * whole authoring loop against a ceiling 2.5x lower than deployed reality and
 * read the result as a property of the loop.
 *
 * These are two hand-maintained numbers for one value in two repositories.
 * The pin test below makes changing THIS side deliberate; it cannot see the
 * other side move, so if tlawn.py's default changes, this comment is the only
 * thing pointing at what to update.
 */
const DEFAULT_RUN_TIMEOUT_MS = 300_000;
const DEFAULT_COMPACTION_TIMEOUT_MS = 180_000;

function normalizeRunTimeoutMs(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1_000
    ? Math.floor(value)
    : DEFAULT_RUN_TIMEOUT_MS;
}

export function resolveDispatchTimeoutMs(
  lifecycle: TlonLifecycleConfig
): number {
  return normalizeRunTimeoutMs(lifecycle.runTimeoutMs);
}

export function resolveCompactionObservationTimeoutMs(
  cfg: OpenClawConfig
): number {
  const timeoutSeconds = (
    cfg as OpenClawConfig & {
      agents?: {
        defaults?: { compaction?: { timeoutSeconds?: unknown } };
      };
    }
  ).agents?.defaults?.compaction?.timeoutSeconds;

  if (
    typeof timeoutSeconds !== 'number' ||
    !Number.isFinite(timeoutSeconds) ||
    timeoutSeconds < 0
  ) {
    return DEFAULT_COMPACTION_TIMEOUT_MS;
  }

  return Math.min(Number.MAX_SAFE_INTEGER, Math.floor(timeoutSeconds) * 1_000);
}

type AgentEvent = {
  runId: string;
  stream: string;
  data: Record<string, unknown>;
};

export function isAgentTimeoutEvent(event: AgentEvent, runId: string): boolean {
  if (event.runId !== runId || event.stream !== 'lifecycle') {
    return false;
  }

  const phase = event.data.phase;
  if (phase !== 'end' && phase !== 'error' && phase !== 'finishing') {
    return false;
  }

  return (
    (typeof event.data.timeoutPhase === 'string' &&
      event.data.timeoutPhase.length > 0) ||
    event.data.stopReason === 'timeout'
  );
}

export type CompactionTimeoutObserver = {
  start: () => void;
  complete: () => void;
  stop: () => void;
};

/**
 * Observe OpenClaw's compaction deadline without taking ownership of it.
 * OpenClaw remains solely responsible for aborting the compaction/run.
 */
export function createCompactionTimeoutObserver(params: {
  timeoutMs: number;
  onTimeout: () => void;
}): CompactionTimeoutObserver {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const clear = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const start = () => {
    clear();
    timeoutId = setTimeout(() => {
      timeoutId = null;
      params.onTimeout();
    }, params.timeoutMs);
  };

  return { start, complete: clear, stop: clear };
}
