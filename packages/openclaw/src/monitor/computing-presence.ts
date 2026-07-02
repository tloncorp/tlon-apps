import {
  clearConversationPresence,
  createComputingStatus,
  getComputingStatusText,
  serializeComputingStatus,
  setConversationPresence,
} from '@tloncorp/api';
import { dr, render } from '@urbit/aura';
import type { RuntimeEnv } from 'openclaw/plugin-sdk';

import { describeError } from '../urbit/errors.js';

type RunState = {
  toolNames: string[];
};

type PublishParams = {
  conversationId: string;
  thinking: boolean;
  toolNames: string[];
};

type PublishedState = Omit<PublishParams, 'conversationId'>;

const DEFAULT_MIN_UPDATE_INTERVAL_MS = 1_000;
const ACTIVE_PRESENCE_TIMEOUT_SECS = 90;
const ACTIVE_PRESENCE_TIMEOUT = render(
  'dr',
  dr.fromSeconds(BigInt(ACTIVE_PRESENCE_TIMEOUT_SECS))
);
// Active %computing entries carry an explicit 90s ship-side timeout. Re-publish
// unchanged active state well inside that window so long healthy runs stay
// visible, while disrupted gateways still age out without a final clear poke.
const DEFAULT_MAX_PUBLISH_AGE_MS = 30_000;
// Stopped runIds remembered per conversation so a late keepalive refresh
// cannot resurrect a run that was just stopped. Capped because tombstones
// only matter for the few seconds until the keepalive loop fully stops.
const STOPPED_RUN_MEMORY = 8;

export type ComputingPresenceReporter = {
  publish: (params: PublishParams) => Promise<void>;
};

function normalizeToolName(toolName?: string | null) {
  const trimmed = toolName?.trim();
  return trimmed ? trimmed : null;
}

export function createComputingPresenceReporter(): ComputingPresenceReporter {
  return {
    publish: async ({ conversationId, thinking, toolNames }) => {
      if (!thinking) {
        await clearConversationPresence({
          conversationId,
          topic: 'computing',
        });
        return;
      }

      const toolCalls = toolNames.map((toolName) => ({ toolName }));
      const status = createComputingStatus({ thinking, toolCalls });

      await setConversationPresence({
        conversationId,
        topic: 'computing',
        disclose: [],
        timeout: ACTIVE_PRESENCE_TIMEOUT,
        display: {
          text: getComputingStatusText(status),
          blob: serializeComputingStatus({ thinking, toolCalls }),
        },
      });
    },
  };
}

export function createComputingPresenceTracker(trackerOpts?: {
  reporter?: ComputingPresenceReporter;
  runtime?: RuntimeEnv;
  minUpdateIntervalMs?: number;
  maxPublishAgeMs?: number;
}) {
  const reporter = trackerOpts?.reporter ?? createComputingPresenceReporter();
  const runtime = trackerOpts?.runtime;
  const minUpdateIntervalMs = Math.max(
    0,
    trackerOpts?.minUpdateIntervalMs ?? DEFAULT_MIN_UPDATE_INTERVAL_MS
  );
  const maxPublishAgeMs = Math.max(
    minUpdateIntervalMs,
    trackerOpts?.maxPublishAgeMs ?? DEFAULT_MAX_PUBLISH_AGE_MS
  );
  const conversations = new Map<string, Map<string, RunState>>();
  const lastPublishedState = new Map<string, PublishedState>();
  const lastPublishedAt = new Map<string, number>();
  const pendingState = new Map<string, PublishedState>();
  const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const stoppedRuns = new Map<string, Set<string>>();

  const markRunStopped = (conversationId: string, runId: string) => {
    let stopped = stoppedRuns.get(conversationId);
    if (!stopped) {
      stopped = new Set();
      stoppedRuns.set(conversationId, stopped);
    }

    stopped.delete(runId);
    stopped.add(runId);
    while (stopped.size > STOPPED_RUN_MEMORY) {
      const oldest = stopped.values().next().value;
      if (oldest === undefined) {
        break;
      }
      stopped.delete(oldest);
    }
  };

  const isRunStopped = (conversationId: string, runId: string) =>
    stoppedRuns.get(conversationId)?.has(runId) ?? false;

  const clearRunStopped = (conversationId: string, runId: string) => {
    const stopped = stoppedRuns.get(conversationId);
    if (!stopped) {
      return;
    }

    stopped.delete(runId);
    if (stopped.size === 0) {
      stoppedRuns.delete(conversationId);
    }
  };

  const clonePublishedState = (state: PublishedState): PublishedState => ({
    thinking: state.thinking,
    toolNames: [...state.toolNames],
  });

  const statesEqual = (left?: PublishedState, right?: PublishedState) => {
    if (!left || !right) {
      return false;
    }

    if (left.thinking !== right.thinking) {
      return false;
    }

    if (left.toolNames.length !== right.toolNames.length) {
      return false;
    }

    for (let index = 0; index < left.toolNames.length; index += 1) {
      if (left.toolNames[index] !== right.toolNames[index]) {
        return false;
      }
    }

    return true;
  };

  const clearPending = (conversationId: string) => {
    const timer = pendingTimers.get(conversationId);
    if (timer) {
      clearTimeout(timer);
      pendingTimers.delete(conversationId);
    }

    pendingState.delete(conversationId);
  };

  const publishNow = async (conversationId: string, state: PublishedState) => {
    clearPending(conversationId);
    await reporter.publish({
      conversationId,
      ...state,
    });
    if (!state.thinking) {
      // idle is the terminal state; drop the records so the maps do not grow
      // unboundedly across the gateway's lifetime
      lastPublishedState.delete(conversationId);
      lastPublishedAt.delete(conversationId);
      return;
    }
    lastPublishedState.set(conversationId, clonePublishedState(state));
    lastPublishedAt.set(conversationId, Date.now());
  };

  const flushPending = async (conversationId: string) => {
    const nextState = pendingState.get(conversationId);
    clearPending(conversationId);

    if (!nextState) {
      return;
    }

    if (statesEqual(lastPublishedState.get(conversationId), nextState)) {
      return;
    }

    await publishNow(conversationId, nextState);
  };

  const publishThrottled = async (
    conversationId: string,
    state: PublishedState
  ) => {
    if (statesEqual(lastPublishedState.get(conversationId), state)) {
      const publishedAt = lastPublishedAt.get(conversationId) ?? 0;
      if (Date.now() - publishedAt < maxPublishAgeMs) {
        clearPending(conversationId);
        return;
      }
      // fall through: re-publish before the ship-side presence expires
    }

    if (minUpdateIntervalMs === 0) {
      await publishNow(conversationId, state);
      return;
    }

    const now = Date.now();
    const nextAllowedAt =
      (lastPublishedAt.get(conversationId) ?? 0) + minUpdateIntervalMs;
    if (now >= nextAllowedAt) {
      await publishNow(conversationId, state);
      return;
    }

    pendingState.set(conversationId, clonePublishedState(state));
    if (pendingTimers.has(conversationId)) {
      return;
    }

    const timer = setTimeout(() => {
      pendingTimers.delete(conversationId);
      void safelySync(conversationId, 'flush', async () => {
        await flushPending(conversationId);
      });
    }, nextAllowedAt - now);
    pendingTimers.set(conversationId, timer);
  };

  const syncConversation = async (conversationId: string) => {
    const runs = conversations.get(conversationId);
    const previousState = lastPublishedState.get(conversationId);

    if (!runs || runs.size === 0) {
      conversations.delete(conversationId);
      if (previousState?.thinking) {
        await publishNow(conversationId, {
          thinking: false,
          toolNames: [],
        });
      }

      return;
    }

    const seenToolNames = new Set<string>();
    const toolNames: string[] = [];

    for (const run of runs.values()) {
      for (const toolName of run.toolNames) {
        if (seenToolNames.has(toolName)) {
          continue;
        }

        seenToolNames.add(toolName);
        toolNames.push(toolName);
      }
    }

    const currentState: PublishedState = {
      thinking: true,
      toolNames,
    };

    if (!previousState || !previousState.thinking) {
      await publishNow(conversationId, currentState);
    } else {
      await publishThrottled(conversationId, currentState);
    }
  };

  const getRun = (conversationId: string, runId: string) =>
    conversations.get(conversationId)?.get(runId);

  const ensureRun = (conversationId: string, runId: string) => {
    let runs = conversations.get(conversationId);
    if (!runs) {
      runs = new Map();
      conversations.set(conversationId, runs);
    }

    let run = runs.get(runId);
    if (!run) {
      run = {
        toolNames: [],
      };
      runs.set(runId, run);
    }

    return run;
  };

  const safelySync = async (
    conversationId: string,
    action: string,
    fn: () => Promise<void>
  ) => {
    try {
      await fn();
    } catch (error) {
      runtime?.error?.(
        `[tlon] Failed to ${action} computing presence for ${conversationId}: ${describeError(error)}`
      );
    }
  };

  return {
    refreshRun: async (params: { conversationId: string; runId: string }) => {
      if (isRunStopped(params.conversationId, params.runId)) {
        return;
      }

      await safelySync(params.conversationId, 'refresh', async () => {
        ensureRun(params.conversationId, params.runId);
        await syncConversation(params.conversationId);
      });
    },

    addToolCall: async (params: {
      conversationId: string;
      runId: string;
      toolName?: string | null;
    }) => {
      const toolName = normalizeToolName(params.toolName);
      if (!toolName) {
        return;
      }

      await safelySync(params.conversationId, 'update', async () => {
        // real activity resumes a previously stopped run
        clearRunStopped(params.conversationId, params.runId);
        const run = ensureRun(params.conversationId, params.runId);
        if (!run.toolNames.includes(toolName)) {
          run.toolNames.push(toolName);
        }
        await syncConversation(params.conversationId);
      });
    },

    clearToolCalls: async (params: {
      conversationId: string;
      runId: string;
    }) => {
      await safelySync(params.conversationId, 'clear tools for', async () => {
        const run = getRun(params.conversationId, params.runId);
        if (!run || run.toolNames.length === 0) {
          return;
        }

        run.toolNames = [];
        await syncConversation(params.conversationId);
      });
    },

    stopRun: async (params: { conversationId: string; runId: string }) => {
      markRunStopped(params.conversationId, params.runId);
      await safelySync(params.conversationId, 'clear', async () => {
        const runs = conversations.get(params.conversationId);
        if (!runs) {
          if (lastPublishedState.get(params.conversationId)?.thinking) {
            await publishNow(params.conversationId, {
              thinking: false,
              toolNames: [],
            });
          }
          return;
        }

        runs.delete(params.runId);
        if (runs.size === 0) {
          conversations.delete(params.conversationId);
        }

        await syncConversation(params.conversationId);
      });
    },
  };
}
