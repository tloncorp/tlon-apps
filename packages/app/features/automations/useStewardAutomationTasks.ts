import { useQuery } from '@tanstack/react-query';
import * as api from '@tloncorp/api';
import type {
  StewardAutomationTask,
  StewardAutomationTaskInput,
} from '@tloncorp/api/urbit';
import { queryClient } from '@tloncorp/shared';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import {
  type AutomationSnapshot,
  applyAutomationUpdate,
  applyTaskPatch,
} from '../../ui/components/automationTaskDraft';

export type StewardAutomationSnapshot = AutomationSnapshot;

export const stewardAutomationQueryKey = ['stewardAutomationTasks'] as const;

function setSnapshot(
  update: (snapshot: AutomationSnapshot | undefined) => AutomationSnapshot
) {
  queryClient.setQueryData<AutomationSnapshot>(
    stewardAutomationQueryKey,
    update
  );
}

// The profile, the list and the editor are stacked and all read the mirror,
// so they share one watch on the ship rather than opening one each.
let feedUsers = 0;
let feed: Promise<number> | null = null;
// A channel reset replays the watch under a new id. The feed opens every
// watch with a full snapshot, so the id seen on the latest fact is the one
// to close; the id the subscribe resolved with may by then name another
// subscription.
let feedId: number | undefined;

function retainAutomationFeed() {
  feedUsers += 1;
  if (!feed) {
    feedId = undefined;
    const opening = api.subscribeToAutomations((update, id) => {
      if (feed === opening && id !== undefined) feedId = id;
      setSnapshot((snapshot) => applyAutomationUpdate(snapshot, update));
    });
    feed = opening;
    // A ship without the automation module rejects the watch; the query's
    // 404 already reports that as unavailable.
    opening.catch(() => {
      if (feed === opening) feed = null;
    });
  }
  return () => {
    feedUsers -= 1;
    if (feedUsers > 0 || !feed) return;
    const closing = feed;
    const latestId = feedId;
    feed = null;
    feedId = undefined;
    void closing
      .then((openedId) => api.unsubscribe(latestId ?? openedId))
      .catch(() => {});
  };
}

export function useStewardAutomationTasks(enabled = true) {
  useEffect(() => (enabled ? retainAutomationFeed() : undefined), [enabled]);

  return useQuery<AutomationSnapshot>({
    queryKey: stewardAutomationQueryKey,
    queryFn: async () => {
      try {
        return {
          available: true,
          tasks: await api.scryAutomations(),
        };
      } catch (error) {
        if (error instanceof api.BadResponseError && error.status === 404) {
          return { available: false, tasks: {} };
        }
        throw error;
      }
    },
    enabled,
    staleTime: 15_000,
    refetchOnMount: 'always',
    retry: (attempts, error) =>
      !(error instanceof api.BadResponseError && error.status === 404) &&
      attempts < 2,
  });
}

export function tasksForShip(
  snapshot: AutomationSnapshot | undefined,
  ship: string
) {
  return snapshot?.tasks[ship];
}

// The owner's ship answers `pending` after 20 seconds when the bot has not
// replied; give the bot another half minute before reporting that.
async function settle(edit: Promise<api.StewardAutomationEditResult>) {
  try {
    return await edit;
  } catch (error) {
    if (error instanceof api.StewardAutomationPendingError) {
      return api.awaitAutomationRequest(error.requestId, { attempts: 15 });
    }
    throw error;
  }
}

// The bot answers an edit before it re-projects its tasks, so for a moment
// the mirror on the owner's ship still holds the old state. A scry in that
// window would undo the update below until the feed catches up.
const SETTLE_WINDOW_MS = 5_000;
let lastEditAt = 0;

/** Refetch the mirror on focus, unless an edit was applied a moment ago. */
export function refetchAutomationsOnFocus(refetch: () => unknown) {
  if (Date.now() - lastEditAt > SETTLE_WINDOW_MS) {
    void refetch();
  }
}

function setTask(bot: string, id: string, task: StewardAutomationTask | null) {
  lastEditAt = Date.now();
  setSnapshot((snapshot) =>
    applyAutomationUpdate(
      snapshot,
      task ? { set: { ship: bot, id, task } } : { del: { ship: bot, id } }
    )
  );
}

/**
 * Edits to one bot's tasks. Each resolves once the bot has applied the change
 * and rejects with the typed error otherwise. The cache is updated from the
 * answer, since the bot's own re-projection reaches the feed a moment later.
 */
export function useAutomationTaskActions(bot: string) {
  // A create the bot has not answered yet. Asking again would make a second
  // task if the first one lands late, so a retry waits on the same request.
  const unanswered = useRef<{
    requestId: string;
    task: StewardAutomationTaskInput;
  } | null>(null);
  const create = useCallback(
    async (task: StewardAutomationTaskInput) => {
      const waiting = unanswered.current;
      try {
        const { id } = await (waiting
          ? api.awaitAutomationRequest(waiting.requestId, { attempts: 15 })
          : settle(api.createAutomation({ bot, task })));
        unanswered.current = null;
        setTask(bot, id, waiting?.task ?? task);
        return id;
      } catch (error) {
        unanswered.current =
          error instanceof api.StewardAutomationPendingError
            ? { requestId: error.requestId, task: waiting?.task ?? task }
            : null;
        throw error;
      }
    },
    [bot]
  );

  const update = useCallback(
    async (id: string, patch: StewardAutomationTaskInput) => {
      await settle(api.updateAutomation({ bot, id, task: patch }));
      const current = tasksForShip(
        queryClient.getQueryData<AutomationSnapshot>(stewardAutomationQueryKey),
        bot
      )?.[id];
      if (current) setTask(bot, id, applyTaskPatch(current, patch));
    },
    [bot]
  );

  const remove = useCallback(
    async (id: string) => {
      try {
        await settle(api.deleteAutomation({ bot, id }));
      } catch (error) {
        // Already gone is the outcome that was asked for.
        if (
          !(error instanceof api.StewardAutomationEditError) ||
          error.errorType !== 'not-found'
        ) {
          throw error;
        }
      }
      setTask(bot, id, null);
    },
    [bot]
  );

  return useMemo(() => ({ create, update, remove }), [create, update, remove]);
}
