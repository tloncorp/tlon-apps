import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';

import type { TlonLifecycleConfig } from '../types.js';

const DEFAULT_COMPACTION_TIMEOUT_MS = 180_000;

/**
 * Resolve the explicit Tlon run timeout (`channels.tlon.lifecycle.runTimeoutMs`).
 * Returns `undefined` when unset or invalid so OpenClaw's own
 * `agents.defaults.timeoutSeconds` governs the turn; the plugin imposes no
 * timeout of its own.
 */
export function resolveDispatchTimeoutMs(
  lifecycle: TlonLifecycleConfig
): number | undefined {
  const value = lifecycle.runTimeoutMs;
  return typeof value === 'number' && Number.isFinite(value) && value >= 1_000
    ? Math.floor(value)
    : undefined;
}

/**
 * Reply options carrying the Tlon run timeout to OpenClaw. Empty when no
 * timeout is configured so the key is omitted and OpenClaw's
 * `agents.defaults.timeoutSeconds` applies.
 */
export function resolveTimeoutOverrideReplyOptions(
  dispatchTimeoutMs: number | undefined
): { timeoutOverrideSeconds?: number } {
  return dispatchTimeoutMs !== undefined
    ? { timeoutOverrideSeconds: Math.ceil(dispatchTimeoutMs / 1000) }
    : {};
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
