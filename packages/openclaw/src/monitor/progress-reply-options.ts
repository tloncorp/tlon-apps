import type { PluginRuntime } from 'openclaw/plugin-sdk/core';

type ReplyOptions = NonNullable<
  Parameters<
    PluginRuntime['channel']['reply']['dispatchReplyWithBufferedBlockDispatcher']
  >[0]['replyOptions']
>;

export type ProgressReplyOptions = Pick<
  ReplyOptions,
  | 'onItemEvent'
  | 'onQueuedFollowupSettled'
  | 'commentaryProgressEnabled'
  | 'suppressDefaultToolProgressMessages'
  | 'allowProgressCallbacksWhenSourceDeliverySuppressed'
  | 'preserveProgressCallbackStartOrder'
>;

type RunPresenceTarget = { conversationId: string; runId: string };

export type ProgressPresenceTracker = {
  setCommentary: (params: RunPresenceTarget & { text: string }) => void;
  stopRun: (params: RunPresenceTarget) => void;
};

/**
 * Reply options that route the agent's pre-tool commentary into the Thinking
 * row. The flags also make core forward tool and compaction callbacks while
 * verbose is off, which is what brings tool labels back to the row.
 */
export function buildProgressReplyOptions(params: {
  enabled: boolean;
  presenceConversationId: string | null | undefined;
  presenceRunId: string;
  computingPresence: ProgressPresenceTracker;
}): ProgressReplyOptions {
  const { enabled, presenceConversationId, presenceRunId, computingPresence } =
    params;
  if (!enabled || !presenceConversationId) {
    return {};
  }

  const target = {
    conversationId: presenceConversationId,
    runId: presenceRunId,
  };
  let lastPreambleText: string | null = null;

  return {
    onItemEvent: (payload) => {
      if (payload.kind !== 'preamble') {
        return;
      }

      const text = payload.progressText ?? '';
      // Core can re-apply a streamed delta to a shared snapshot, producing the
      // previous text twice with no corrected snapshot after it.
      if (
        text &&
        lastPreambleText !== null &&
        text === lastPreambleText.repeat(2)
      ) {
        return;
      }

      lastPreambleText = text;
      computingPresence.setCommentary({ ...target, text });
    },
    onQueuedFollowupSettled: () => {
      computingPresence.stopRun(target);
    },
    commentaryProgressEnabled: true,
    suppressDefaultToolProgressMessages: true,
    allowProgressCallbacksWhenSourceDeliverySuppressed: true,
    // onItemEvent remembers the last snapshot, so core must start progress
    // callbacks in source order.
    preserveProgressCallbackStartOrder: true,
  };
}
