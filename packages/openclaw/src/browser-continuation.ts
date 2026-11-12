import { randomUUID } from 'node:crypto';
import type { PluginRuntime } from 'openclaw/plugin-sdk/core';
import { deliveryContextFromSession } from 'openclaw/plugin-sdk/session-store-runtime';

import type { createComputingPresenceTracker } from './monitor/computing-presence.js';
import { buildProgressReplyOptions } from './monitor/progress-reply-options.js';
import { sharedSlot } from './shared-state.js';
import { parseTlonTarget } from './targets.js';

type Run = PluginRuntime['subagent']['run'];
type AgentEvent = Parameters<
  Parameters<PluginRuntime['events']['onAgentEvent']>[0]
>[0];
const slot = sharedSlot<ReturnType<typeof createBrowserContinuationRunner>>(
  'browserContinuationRunner'
);

export function createBrowserContinuationRunner({
  runtime,
  presence,
  showCommentary,
  warn,
}: {
  runtime: PluginRuntime;
  presence: ReturnType<typeof createComputingPresenceTracker>;
  showCommentary: boolean;
  warn: (message: string) => void;
}) {
  const cleanups = new Set<() => void>();
  const run: Run = async (request) => {
    const entry = runtime.agent.session.getSessionEntry({
      sessionKey: request.sessionKey,
    });
    const delivery = deliveryContextFromSession(entry);
    const target =
      delivery?.channel === 'tlon' ? parseTlonTarget(delivery.to) : null;
    if (!target) {
      warn('[tlon] Browser continuation has no Tlon presence route.');
      return runtime.subagent.run(request);
    }
    const presenceTarget = {
      conversationId: target.kind === 'dm' ? target.ship : target.nest,
      runId: `browser-continuation:${randomUUID()}`,
    };
    const progress = buildProgressReplyOptions({
      enabled: showCommentary,
      presenceConversationId: presenceTarget.conversationId,
      presenceRunId: presenceTarget.runId,
      computingPresence: presence,
    });
    let active = true;
    let runId: string | undefined;
    // The gateway can emit progress before returning its accepted run ID.
    const earlyEvents: AgentEvent[] = [];
    const onEvent = (event: AgentEvent) => {
      if (!active || event.runId !== runId) return;
      if (
        event.stream === 'lifecycle' &&
        ['end', 'error'].includes(String(event.data.phase))
      ) {
        cleanup();
      } else if (
        event.stream === 'tool' &&
        event.data.phase === 'start' &&
        !event.data.hideFromChannelProgress
      ) {
        presence.addToolCall({
          ...presenceTarget,
          toolName:
            typeof event.data.name === 'string' ? event.data.name : undefined,
        });
      } else if (
        event.stream === 'item' &&
        event.data.kind === 'preamble' &&
        !event.data.hideFromChannelProgress
      ) {
        presence.clearToolCalls(presenceTarget);
        progress.onItemEvent?.({
          kind: 'preamble',
          progressText:
            typeof event.data.progressText === 'string'
              ? event.data.progressText
              : '',
        });
      } else if (event.stream === 'assistant') {
        presence.clearToolCalls(presenceTarget);
      }
    };
    const unsubscribe = runtime.events.onAgentEvent((event) => {
      if (runId) onEvent(event);
      else if (event.sessionKey === request.sessionKey) {
        earlyEvents.push(event);
        if (earlyEvents.length > 100) earlyEvents.shift();
      }
    });
    const heartbeat = setInterval(
      () => presence.refreshRun(presenceTarget),
      20_000
    );
    heartbeat.unref();
    function cleanup() {
      if (!active) return;
      active = false;
      clearInterval(heartbeat);
      unsubscribe();
      presence.stopRun(presenceTarget);
      cleanups.delete(cleanup);
    }
    cleanups.add(cleanup);
    presence.refreshRun(presenceTarget);
    try {
      const result = await runtime.subagent.run(request);
      runId = result.runId;
      for (const event of earlyEvents) onEvent(event);
      earlyEvents.length = 0;
      // Also handles idempotent delivery of an already-completed run, which
      // emits no new lifecycle events. A wait timeout is not a run failure.
      void (async () => {
        try {
          while (active) {
            const result = await runtime.subagent.waitForRun({
              runId,
              timeoutMs: 60_000,
            });
            if (result.status !== 'timeout') break;
          }
        } catch {
          if (active)
            warn(
              '[tlon] Browser continuation presence could not observe completion.'
            );
        } finally {
          cleanup();
        }
      })();
      return result;
    } catch (error) {
      cleanup();
      throw error;
    }
  };
  return {
    run,
    stop: () => {
      for (const cleanup of cleanups) cleanup();
    },
  };
}

export function publishBrowserContinuationRunner(
  runner: ReturnType<typeof createBrowserContinuationRunner>
) {
  slot.set(runner);
  return () => {
    runner.stop();
    if (slot.get() === runner) slot.set(null);
  };
}

export function resumeBrowserContinuation(
  runtime: PluginRuntime,
  request: Parameters<Run>[0]
) {
  return (slot.get()?.run ?? runtime.subagent.run)(request);
}
