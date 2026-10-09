import { useQuery } from '@tanstack/react-query';
import * as api from '@tloncorp/api';
import type {
  StewardAutomationTask,
  StewardAutomationTaskInput,
  StewardAutomationUpdate,
} from '@tloncorp/api/urbit';
import { queryClient } from '@tloncorp/shared';
import { useCallback, useEffect, useMemo } from 'react';

import {
  type AutomationSnapshot,
  applyAutomationUpdate,
  applyTaskPatch,
  isTaskFromCreate,
  snapshotAfterCreate,
  snapshotAfterRead,
  tasksRemoved,
} from '../../ui/components/automationTaskDraft';
import { makeCreateOnce } from './createOnce';
import { createSharedFeed, readAlongsideFeed } from './sharedFeed';

export type StewardAutomationSnapshot = AutomationSnapshot;

export const stewardAutomationQueryKey = ['stewardAutomationTasks'] as const;

function cachedSnapshot() {
  return queryClient.getQueryData<AutomationSnapshot>(
    stewardAutomationQueryKey
  );
}

function setSnapshot(
  update: (snapshot: AutomationSnapshot | undefined) => AutomationSnapshot
) {
  const before = cachedSnapshot();
  const after = update(before);
  forgetCreatesOfRemoved(before, after);
  queryClient.setQueryData<AutomationSnapshot>(
    stewardAutomationQueryKey,
    after
  );
}

// Facts the feed has delivered, so a read of the mirror can tell that one
// arrived while it was out.
let feedFacts = 0;

// The bot answers an edit before it re-projects its tasks, so for a moment
// the mirror on the owner's ship still holds the old state. A read of the
// mirror from that moment would undo the edit until the feed catches up, so
// none is started on focus and one already out is not applied.
const SETTLE_WINDOW_MS = 5_000;
let lastEditAt = 0;

// The profile, the list and the editor are stacked and all read the mirror,
// so they share one watch on the ship rather than opening one each.
const retainAutomationFeed = createSharedFeed<StewardAutomationUpdate>({
  open: (onUpdate, onRejected) =>
    api.subscribeToAutomations(onUpdate, onRejected),
  close: (id) => api.unsubscribe(id),
  onUpdate: (update) => {
    feedFacts += 1;
    setSnapshot((snapshot) => applyAutomationUpdate(snapshot, update));
  },
  // A ship without the automation module turns the watch down every time;
  // the query's 404 already reports that as unavailable.
  shouldReopen: () => cachedSnapshot()?.available !== false,
});

export function useStewardAutomationTasks(enabled = true) {
  useEffect(() => (enabled ? retainAutomationFeed() : undefined), [enabled]);

  return useQuery<AutomationSnapshot>({
    queryKey: stewardAutomationQueryKey,
    queryFn: async () => {
      try {
        const tasks = await readAlongsideFeed(
          api.scryAutomations,
          () => feedFacts,
          {
            keptByFeed: () => {
              const cached = cachedSnapshot();
              return cached?.available ? cached.tasks : undefined;
            },
          }
        );
        const cached = cachedSnapshot();
        const read = snapshotAfterRead({ available: true, tasks }, cached, {
          editedMsAgo: Date.now() - lastEditAt,
          settleMs: SETTLE_WINDOW_MS,
        });
        forgetCreatesOfRemoved(cached, read);
        // The feed gives up on a node that answers "not found". This read
        // has just shown the node has the module after all.
        retainAutomationFeed.wake();
        return read;
      } catch (error) {
        if (hasNoAutomations(error)) {
          return { available: false, tasks: {} };
        }
        throw error;
      }
    },
    enabled,
    staleTime: 15_000,
    refetchOnMount: 'always',
    retry: (attempts, error) => !hasNoAutomations(error) && attempts < 2,
  });
}

// A node without the automation module: one that answers "not found", or
// one whose desk is known to be older than the module, which the request is
// never sent to.
function hasNoAutomations(error: unknown) {
  return (
    error instanceof api.DeskUnsupportedError ||
    (error instanceof api.BadResponseError && error.status === 404)
  );
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

/**
 * Refetch the mirror on focus, unless an edit was applied a moment ago.
 * Several screens can ask at once, each with its own entry on show, so a
 * read already under way is joined rather than started over.
 */
export function refetchAutomationsOnFocus(
  refetch: (options: { cancelRefetch: boolean }) => unknown
) {
  if (Date.now() - lastEditAt > SETTLE_WINDOW_MS) {
    void refetch({ cancelRefetch: false });
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

const createOnce = makeCreateOnce({
  newRequestId: api.newAutomationRequestId,
  send: (request: {
    bot: string;
    task: StewardAutomationTaskInput;
    requestId: string;
  }) => settle(api.createAutomation(request)),
  // A typed error is the bot's answer. Anything else (still pending, a
  // dropped connection) leaves the create unanswered.
  isAnswer: (error) => error instanceof api.StewardAutomationEditError,
});

// A create that went unanswered can still land, and its task can then be
// deleted. Asking for the same task after that is a new request; under the
// old id the owner's ship would answer "created" from its record and make
// nothing. A task can leave the mirror by a delete here, a `del` or `gone`
// from the feed, or a whole new set of tasks after a gap that leaves it out,
// so this runs on every change to the cache.
function forgetCreatesOfRemoved(
  before: AutomationSnapshot | undefined,
  after: AutomationSnapshot
) {
  for (const { ship, task } of tasksRemoved(before, after)) {
    createOnce.forget(ship, (created) => isTaskFromCreate(created, task));
  }
}

/**
 * Edits to one bot's tasks. Each resolves once the bot has applied the change
 * and rejects with the typed error otherwise. The cache is updated from the
 * answer, since the bot's own re-projection reaches the feed a moment later.
 */
export function useAutomationTaskActions(bot: string) {
  const create = useCallback(
    async (task: StewardAutomationTaskInput) => {
      const { id } = await createOnce(bot, task);
      lastEditAt = Date.now();
      setSnapshot((snapshot) => snapshotAfterCreate(snapshot, bot, id, task));
      return id;
    },
    [bot]
  );

  const update = useCallback(
    async (id: string, patch: StewardAutomationTaskInput) => {
      await settle(api.updateAutomation({ bot, id, task: patch }));
      const current = tasksForShip(cachedSnapshot(), bot)?.[id];
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
