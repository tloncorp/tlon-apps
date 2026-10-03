import {
  clearConversationPresence,
  createComputingStatus,
  getComputingStatusText,
  serializeComputingStatus,
  setConversationPresence,
} from '@tloncorp/api';
import { dr, render } from '@urbit/aura';
import type { RuntimeEnv } from 'openclaw/plugin-sdk/runtime';

import { describeError } from '../urbit/errors.js';

type RunState = {
  toolNames: string[];
  commentary: string | null;
  commentarySeq: number;
};

type PublishParams = {
  conversationId: string;
  thinking: boolean;
  toolNames: string[];
  commentary: string | null;
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
// Guard against runaway commentary; normal pre-tool commentary is far shorter.
export const COMMENTARY_MAX_CHARS = 100;
const COMMENTARY_WORD_BREAK_WINDOW = 20;
const ELLIPSIS = '…';

export type ComputingPresenceReporter = {
  publish: (params: PublishParams) => Promise<void>;
};

function normalizeToolName(toolName?: string | null) {
  const trimmed = toolName?.trim();
  return trimmed ? trimmed : null;
}

export function formatCommentaryForPresence(text: string): string | null {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (!collapsed) {
    return null;
  }

  // Counted in code points so the cut never splits a surrogate pair.
  const codePoints = Array.from(collapsed);
  if (codePoints.length <= COMMENTARY_MAX_CHARS) {
    return collapsed;
  }

  const limit = COMMENTARY_MAX_CHARS - 1;
  let cut = limit;
  for (
    let index = limit;
    index >= limit - COMMENTARY_WORD_BREAK_WINDOW && index > 0;
    index -= 1
  ) {
    if (codePoints[index] === ' ') {
      cut = index;
      break;
    }
  }

  return `${codePoints.slice(0, cut).join('').trimEnd()}${ELLIPSIS}`;
}

export function createComputingPresenceReporter(): ComputingPresenceReporter {
  return {
    publish: async ({ conversationId, thinking, toolNames, commentary }) => {
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
          text: commentary ?? getComputingStatusText(status),
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
  const desiredState = new Map<string, PublishedState>();
  const desiredRevision = new Map<string, number>();
  const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const scheduledConversations = new Set<string>();
  const publishingConversations = new Set<string>();
  const stoppedRuns = new Map<string, Set<string>>();
  let commentarySequence = 0;

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
    commentary: state.commentary,
  });

  const statesEqual = (left?: PublishedState, right?: PublishedState) => {
    if (!left || !right) {
      return false;
    }

    if (
      left.thinking !== right.thinking ||
      left.commentary !== right.commentary
    ) {
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

  const clearPendingTimer = (conversationId: string) => {
    const timer = pendingTimers.get(conversationId);
    if (timer) {
      clearTimeout(timer);
      pendingTimers.delete(conversationId);
    }
  };

  const schedulePublish = (conversationId: string) => {
    if (
      publishingConversations.has(conversationId) ||
      scheduledConversations.has(conversationId) ||
      pendingTimers.has(conversationId)
    ) {
      return;
    }

    // Lifecycle hooks only enqueue state. Starting the worker in a microtask
    // keeps ship I/O out of the OpenClaw callback stack entirely.
    scheduledConversations.add(conversationId);
    queueMicrotask(() => {
      scheduledConversations.delete(conversationId);
      void publishDesiredState(conversationId);
    });
  };

  const enqueueState = (conversationId: string, state: PublishedState) => {
    desiredState.set(conversationId, clonePublishedState(state));
    desiredRevision.set(
      conversationId,
      (desiredRevision.get(conversationId) ?? 0) + 1
    );
    clearPendingTimer(conversationId);
    schedulePublish(conversationId);
  };

  async function publishDesiredState(conversationId: string) {
    if (publishingConversations.has(conversationId)) {
      return;
    }

    const state = desiredState.get(conversationId);
    const revision = desiredRevision.get(conversationId);
    if (!state || revision === undefined) {
      return;
    }

    const previousState = lastPublishedState.get(conversationId);
    if (statesEqual(previousState, state)) {
      const publishedAt = lastPublishedAt.get(conversationId) ?? 0;
      if (!state.thinking || Date.now() - publishedAt < maxPublishAgeMs) {
        return;
      }
      // Re-publish before the ship-side active presence expires.
    }

    if (previousState?.thinking && state.thinking && minUpdateIntervalMs > 0) {
      const nextAllowedAt =
        (lastPublishedAt.get(conversationId) ?? 0) + minUpdateIntervalMs;
      const delayMs = nextAllowedAt - Date.now();
      if (delayMs > 0) {
        const timer = setTimeout(() => {
          pendingTimers.delete(conversationId);
          schedulePublish(conversationId);
        }, delayMs);
        pendingTimers.set(conversationId, timer);
        return;
      }
    }

    publishingConversations.add(conversationId);
    let published = false;
    try {
      await reporter.publish({
        conversationId,
        ...state,
      });
      published = true;
    } catch (error) {
      runtime?.error?.(
        `[tlon] Failed to publish computing presence for ${conversationId}: ${describeError(error)}`
      );
    } finally {
      publishingConversations.delete(conversationId);
    }

    if (published) {
      lastPublishedState.set(conversationId, clonePublishedState(state));
      lastPublishedAt.set(conversationId, Date.now());

      if (
        !state.thinking &&
        statesEqual(desiredState.get(conversationId), state)
      ) {
        // Idle is terminal. Drop the records so these maps stay bounded over
        // the gateway lifetime once the latest desired state is cleared.
        desiredState.delete(conversationId);
        desiredRevision.delete(conversationId);
        lastPublishedState.delete(conversationId);
        lastPublishedAt.delete(conversationId);
      }
    }

    // A single in-flight request owns each conversation. If lifecycle events
    // superseded it, publish only the newest desired state next.
    if (desiredRevision.get(conversationId) !== revision) {
      schedulePublish(conversationId);
    }
  }

  const syncConversation = (conversationId: string) => {
    const runs = conversations.get(conversationId);

    if (!runs || runs.size === 0) {
      conversations.delete(conversationId);
      const currentState =
        desiredState.get(conversationId) ??
        lastPublishedState.get(conversationId);
      if (currentState?.thinking) {
        enqueueState(conversationId, {
          thinking: false,
          toolNames: [],
          commentary: null,
        });
      }

      return;
    }

    const seenToolNames = new Set<string>();
    const toolNames: string[] = [];
    let commentary: string | null = null;
    let commentarySeq = -1;

    for (const run of runs.values()) {
      if (run.commentary !== null && run.commentarySeq > commentarySeq) {
        commentary = run.commentary;
        commentarySeq = run.commentarySeq;
      }

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
      commentary,
    };

    enqueueState(conversationId, currentState);
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
        commentary: null,
        commentarySeq: 0,
      };
      runs.set(runId, run);
    }

    return run;
  };

  return {
    refreshRun: (params: { conversationId: string; runId: string }) => {
      if (isRunStopped(params.conversationId, params.runId)) {
        return;
      }

      ensureRun(params.conversationId, params.runId);
      syncConversation(params.conversationId);
    },

    addToolCall: (params: {
      conversationId: string;
      runId: string;
      toolName?: string | null;
    }) => {
      const toolName = normalizeToolName(params.toolName);
      if (!toolName) {
        return;
      }

      // real activity resumes a previously stopped run
      clearRunStopped(params.conversationId, params.runId);
      const run = ensureRun(params.conversationId, params.runId);
      if (!run.toolNames.includes(toolName)) {
        run.toolNames.push(toolName);
      }
      syncConversation(params.conversationId);
    },

    clearToolCalls: (params: { conversationId: string; runId: string }) => {
      const run = getRun(params.conversationId, params.runId);
      if (!run || run.toolNames.length === 0) {
        return;
      }

      run.toolNames = [];
      syncConversation(params.conversationId);
    },

    setCommentary: (params: {
      conversationId: string;
      runId: string;
      text: string;
    }) => {
      // Unlike addToolCall, late commentary must not resurrect a stopped run.
      if (isRunStopped(params.conversationId, params.runId)) {
        return;
      }

      const commentary = formatCommentaryForPresence(params.text);
      if (commentary === null) {
        const run = getRun(params.conversationId, params.runId);
        if (!run || run.commentary === null) {
          return;
        }

        run.commentary = null;
        syncConversation(params.conversationId);
        return;
      }

      const run = ensureRun(params.conversationId, params.runId);
      run.commentary = commentary;
      run.commentarySeq = ++commentarySequence;
      syncConversation(params.conversationId);
    },

    stopRun: (params: { conversationId: string; runId: string }) => {
      markRunStopped(params.conversationId, params.runId);
      const runs = conversations.get(params.conversationId);
      if (runs) {
        runs.delete(params.runId);
        if (runs.size === 0) {
          conversations.delete(params.conversationId);
        }
      }

      syncConversation(params.conversationId);
    },
  };
}
