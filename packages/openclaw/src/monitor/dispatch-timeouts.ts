import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';

import type { TlonLifecycleConfig } from '../types.js';

// Tool-heavy Tlon turns can legitimately spend several minutes uploading and
// verifying remote resources. Keep a hard cap, but leave enough room for one
// coherent turn to finish without forcing a continuation mid-operation.
const DEFAULT_RUN_TIMEOUT_MS = 900_000;
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
