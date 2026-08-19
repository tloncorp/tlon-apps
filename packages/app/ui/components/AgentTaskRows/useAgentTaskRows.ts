import { lensRunMatchesChannel } from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { useCallback, useMemo } from 'react';

import { buildRunTimeline } from '../Channel/ContextLens/RunTimeline';
import {
  type ContextLens,
  type ContextLensEvent,
  FINAL_STATUSES,
  lensFromRunPayload,
} from '../Channel/ContextLens/types';
import { useConversationComputingState } from '../Channel/useConversationComputingState';
import type { AgentTaskRow } from './AgentTaskRows';
import { projectTaskRows } from './projectTaskRows';

/** How many recent runs to scan for one belonging to this conversation. */
const RECENT_RUN_SCAN = 20;

export type AgentTaskRowsState = {
  rows: AgentTaskRow[];
  /** Wired only when the run failed and can be re-dispatched. */
  onRetry?: () => void;
};

/**
 * The rows to show for agent work in a conversation.
 *
 * Durability comes from the synced lens run: it is cached in SQLite and
 * re-scryable from the owner's %steward, so it survives a restart. Liveness
 * comes from presence, which is sub-second but evaporates after 90s.
 *
 * The lens only reaches the bot's owner, so for everyone else this returns no
 * rows and callers keep showing the existing presence indicator.
 */
export function useAgentTaskRows(channelId: string): AgentTaskRowsState {
  const recentRuns = store.useRecentContextLensRuns(RECENT_RUN_SCAN);
  const live = useConversationComputingState(channelId);

  const run = useMemo<{ lens: ContextLens; botShip: string } | null>(() => {
    for (const row of recentRuns.data ?? []) {
      if (!lensRunMatchesChannel(row, channelId)) {
        continue;
      }
      const lens = lensFromRunPayload(row.payload);
      if (lens) {
        return { lens, botShip: row.botShip };
      }
    }
    return null;
  }, [recentRuns.data, channelId]);

  const rows = useMemo(() => {
    if (!run) {
      return projectTaskRows({
        timeline: null,
        runFinished: false,
        runFailed: false,
        live: null,
      });
    }

    const { lens } = run;
    // The run is already synced, so elapsed-time formatting has a fixed
    // reference. Using updatedAt rather than Date.now keeps this pure and
    // avoids a ticking clock re-rendering rows that will never change again.
    const event: ContextLensEvent = {
      seq: 0,
      at: lens.updatedAt,
      phase: 'sync',
      lens,
    };
    const finished = FINAL_STATUSES.has(lens.status);

    return projectTaskRows({
      timeline: buildRunTimeline([event], event, lens.updatedAt),
      runFinished: finished,
      runFailed: finished && lens.status !== 'completed',
      live: live ? { label: live.label, toolCalls: live.toolCalls } : null,
    });
  }, [run, live]);

  const failed = Boolean(
    run &&
      FINAL_STATUSES.has(run.lens.status) &&
      run.lens.status !== 'completed'
  );

  const onRetry = useCallback(() => {
    if (!run) {
      return;
    }
    void store.retryLensRun({ botShip: run.botShip, lensId: run.lens.lensId });
  }, [run]);

  return { rows, onRetry: failed ? onRetry : undefined };
}
