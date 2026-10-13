import * as api from '@tloncorp/api';
import { queryClient } from '@tloncorp/shared';
import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { useCurrentUserId } from '../../hooks/useCurrentUser';
import type { TaskListAttempt } from '../../ui/components/scheduledTaskSections';
import { useBotEnabled } from '../../utils/botSettings';
import { createMirrorRepair, repairableBot } from './mirrorRepair';
import {
  type StewardAutomationSnapshot,
  stewardAutomationQueryKey,
  tasksForShip,
} from './useStewardAutomationTasks';

// Kept outside any screen, so the one unprompted try per bot holds across
// the list, the editor and every visit to them while the app is open.
const repair = createMirrorRepair({
  ask: (bot) => {
    // The poke makes the owner's ship trust what it names. Whatever a screen
    // was opened with, that is only ever the owner's own bot.
    if (bot !== api.getBotUserIdForUser(api.getCurrentUserId())) {
      throw new Error(`${bot} is not the bot of the owner`);
    }
    return api.trustBot(bot);
  },
  // Joins a read already under way, as a refetch on focus does.
  read: () =>
    queryClient.refetchQueries(
      { queryKey: stewardAutomationQueryKey },
      { cancelRefetch: false }
    ),
  arrived: (bot) =>
    tasksForShip(
      queryClient.getQueryData<StewardAutomationSnapshot>(
        stewardAutomationQueryKey
      ),
      bot
    ) !== undefined,
});

interface MirrorQuery {
  data?: StewardAutomationSnapshot;
  isSuccess: boolean;
  isFetching: boolean;
  isFetchedAfterMount: boolean;
}

/**
 * For a screen showing a bot's tasks: gets a list that is missing, and says
 * how that is going. The first time a missing list is seen it tries by
 * itself, once per bot while the app is open; `refresh` tries whenever it is
 * called.
 *
 * Telling the node to watch a bot also makes the node trust it, and the node
 * cannot say whether it already does. So the node is told only about the
 * owner's own bot, and only while hosting says that bot is turned on. Any
 * other list is read again and nothing more.
 */
export function useTaskListRepair(
  botShip: string,
  query: MirrorQuery
): { attempt?: TaskListAttempt; refresh: () => void } {
  const currentUserId = useCurrentUserId();
  const ownBot = repairableBot(botShip, api.getBotUserIdForUser(currentUserId));
  // One rule for the unprompted try and for a refresh. Until hosting has
  // answered this is false, which spends nothing: the unprompted try is
  // still there to be made once it turns true.
  const botEnabled = useBotEnabled();
  const tell = botEnabled && ownBot !== undefined;

  // A node that has the task module and no list for this bot. What is in
  // the cache when the screen opens may be old, so the list only counts as
  // missing once a read made since then says so too.
  const unsynced =
    query.isSuccess &&
    query.data?.available === true &&
    tasksForShip(query.data, botShip) === undefined;
  const missing = unsynced && query.isFetchedAfterMount;

  const attempt = useSyncExternalStore(repair.subscribe, () =>
    repair.attempt(botShip)
  );
  const mayTryUnprompted = tell && !repair.told(botShip);
  const tryUnprompted = missing && mayTryUnprompted;
  useEffect(() => {
    if (tryUnprompted) repair.unprompted(botShip);
  }, [tryUnprompted, botShip]);

  const refresh = useCallback(
    () => void repair(botShip, { tell }),
    [botShip, tell]
  );

  // The unprompted try starts once the opening read is back and this render
  // is on screen. It is shown as under way from the first render that knows
  // it is coming, so the row does not offer a refresh for a moment first.
  const aboutToTry =
    unsynced && mayTryUnprompted && (missing || query.isFetching);
  return { attempt: attempt ?? (aboutToTry ? 'asking' : undefined), refresh };
}
