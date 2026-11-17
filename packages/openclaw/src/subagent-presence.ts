import type { PluginRuntime } from 'openclaw/plugin-sdk/core';

import {
  type createComputingPresenceTracker,
  formatCommentaryForPresence,
} from './monitor/computing-presence.js';
import { isRecord } from './monitor/group-channels.js';
import {
  type ProgressPresenceTracker,
  type ProgressReplyOptions,
  buildProgressReplyOptions,
} from './monitor/progress-reply-options.js';

type AgentEvent = Parameters<
  Parameters<PluginRuntime['events']['onAgentEvent']>[0]
>[0];
type TrackedRun = {
  conversationId: string;
  presenceRunId: string;
  progress: ProgressReplyOptions;
  heartbeat: ReturnType<typeof setInterval>;
  lastEventAt: number;
};

const BACKGROUND_PREFIX = 'In the background: ';
const HEARTBEAT_MS = 20_000;
const SILENCE_LIMIT_MS = 30 * 60_000;
const RUN_MEMORY = 256;

function rememberRecent<V>(map: Map<string, V>, key: string, value: V) {
  map.delete(key);
  map.set(key, value);
  while (map.size > RUN_MEMORY) {
    const oldest = map.keys().next().value;
    if (oldest === undefined) break;
    map.delete(oldest);
  }
}

/**
 * The child run ID from an accepted `sessions_spawn` result. Core emits the
 * sanitized tool result as `data.result`, and reads acceptance from its
 * `details` the same way (`normalizeAcceptedSessionSpawnResult`).
 *
 * A collector spawn is skipped: its launch is deferred and can run under a
 * different run ID. On 2026.9.4 only that deferred branch of
 * `spawnSubagentDirect` puts `sessionKey` in the accepted result.
 */
function readAcceptedSpawnRunId(event: AgentEvent): string | null {
  const { data } = event;
  if (
    event.stream !== 'tool' ||
    data.phase !== 'result' ||
    data.name !== 'sessions_spawn' ||
    data.isError === true ||
    !isRecord(data.result) ||
    !isRecord(data.result.details) ||
    data.result.details.status !== 'accepted' ||
    'sessionKey' in data.result.details
  ) {
    return null;
  }
  const runId = data.result.details.runId;
  return typeof runId === 'string' && runId.trim() ? runId : null;
}

export function createSubagentPresence({
  events,
  presence,
  showCommentary,
  warn,
}: {
  events: Pick<PluginRuntime['events'], 'onAgentEvent'>;
  presence: ReturnType<typeof createComputingPresenceTracker>;
  showCommentary: boolean;
  warn: (message: string) => void;
}) {
  // Turns the monitor is dispatching right now, by run ID.
  const turns = new Map<string, string>();
  // Accepted children that have not emitted an event yet. A child queued
  // behind a full subagent lane can start long after its spawn result.
  const pending = new Map<string, string>();
  const runs = new Map<string, TrackedRun>();
  // Core can start, or even end, a child before its spawn result arrives.
  const early = new Map<string, 'started' | 'ended'>();
  // The tracker formats the whole string, so the prefix counts inside the
  // row's length limit. Empty text clears the run's commentary, which lets
  // the tracker show its background fallback.
  const backgroundPresence: ProgressPresenceTracker = {
    setCommentary: ({ text, ...target }) =>
      presence.setCommentary({
        ...target,
        text:
          formatCommentaryForPresence(text) === null
            ? ''
            : `${BACKGROUND_PREFIX}${text}`,
      }),
    stopRun: (target) => presence.stopRun(target),
  };

  const endRun = (runId: string) => {
    const run = runs.get(runId);
    if (!run) return;
    clearInterval(run.heartbeat);
    runs.delete(runId);
    presence.stopRun({
      conversationId: run.conversationId,
      runId: run.presenceRunId,
    });
  };

  const tick = (runId: string) => {
    const run = runs.get(runId);
    if (!run) return;
    if (Date.now() - run.lastEventAt >= SILENCE_LIMIT_MS) {
      endRun(runId);
      warn(
        `[tlon] Background presence for subagent run ${runId} had no events for 30 minutes; clearing it.`
      );
    } else {
      presence.refreshRun({
        conversationId: run.conversationId,
        runId: run.presenceRunId,
      });
    }
  };

  const showRow = (runId: string, conversationId: string) => {
    try {
      const presenceRunId = `subagent:${runId}`;
      const heartbeat = setInterval(() => tick(runId), HEARTBEAT_MS);
      heartbeat.unref();
      runs.set(runId, {
        conversationId,
        presenceRunId,
        progress: buildProgressReplyOptions({
          enabled: showCommentary,
          presenceConversationId: conversationId,
          presenceRunId,
          computingPresence: backgroundPresence,
        }),
        heartbeat,
        lastEventAt: Date.now(),
      });
      presence.refreshRun({
        conversationId,
        runId: presenceRunId,
        background: true,
      });
    } catch (error) {
      endRun(runId);
      warn(
        `[tlon] Background presence failed for subagent run ${runId}: ${String(error)}`
      );
    }
  };

  const handleEvent = (event: AgentEvent) => {
    const phase = String(event.data.phase);
    const isLifecycle = event.stream === 'lifecycle';
    const isEnd = isLifecycle && (phase === 'end' || phase === 'error');
    if (isLifecycle && (phase === 'start' || isEnd)) {
      rememberRecent(early, event.runId, isEnd ? 'ended' : 'started');
    }

    const pendingConversationId = pending.get(event.runId);
    if (pendingConversationId !== undefined) {
      pending.delete(event.runId);
      if (isEnd) return;
      // Shown before the event is handled, so its commentary lands and a
      // spawn result it carries finds its caller tracked.
      showRow(event.runId, pendingConversationId);
    }

    const run = runs.get(event.runId);
    if (run) {
      run.lastEventAt = Date.now();
      if (isEnd) {
        endRun(event.runId);
      } else if (
        event.stream === 'item' &&
        event.data.kind === 'preamble' &&
        !event.data.hideFromChannelProgress
      ) {
        run.progress.onItemEvent?.({
          kind: 'preamble',
          progressText:
            typeof event.data.progressText === 'string'
              ? event.data.progressText
              : '',
        });
      }
    }

    const childRunId = readAcceptedSpawnRunId(event);
    if (!childRunId) return;
    // Only a turn the monitor is running now, or a child already shown, can
    // put a row in a conversation.
    const conversationId =
      turns.get(event.runId) ?? runs.get(event.runId)?.conversationId;
    if (
      !conversationId ||
      runs.has(childRunId) ||
      pending.has(childRunId) ||
      early.get(childRunId) === 'ended'
    ) {
      return;
    }
    if (early.get(childRunId) === 'started') {
      showRow(childRunId, conversationId);
    } else {
      rememberRecent(pending, childRunId, conversationId);
    }
  };

  // Listeners run inside core's event emitter.
  const unsubscribe = events.onAgentEvent((event: AgentEvent) => {
    try {
      handleEvent(event);
    } catch (error) {
      warn(
        `[tlon] Background presence failed on a ${event.stream} event for run ${event.runId}: ${String(error)}`
      );
    }
  });

  return {
    noteTurnStart: (runId: string, conversationId: string) => {
      turns.set(runId, conversationId);
    },
    noteTurnEnd: (runId: string) => {
      turns.delete(runId);
    },
    stop: () => {
      for (const runId of [...runs.keys()]) endRun(runId);
      turns.clear();
      pending.clear();
      early.clear();
      unsubscribe();
    },
  };
}
