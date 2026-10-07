import { StackActions, useFocusEffect } from '@react-navigation/native';
import * as api from '@tloncorp/api';
import type { StewardAutomationTask } from '@tloncorp/api/urbit';
import * as store from '@tloncorp/shared/store';
import { useCallback } from 'react';

import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { useNavigation } from '../../navigation/utils';
import { useIsWindowNarrow } from '../../ui';
import { offersScheduledTasks } from '../../ui/components/automationTaskDraft';
import {
  refetchAutomationsOnFocus,
  tasksForShip,
  useStewardAutomationTasks,
} from './useStewardAutomationTasks';

/**
 * What a way into the owner's bot's scheduled tasks needs: whether to show
 * it, the tasks behind it, and which bot they belong to. Every entry point
 * goes through this, so they appear and disappear together.
 */
export function useScheduledTasksEntry({
  enabled = true,
  forShip,
  whileLoading = false,
}: {
  enabled?: boolean;
  /**
   * The ship the surface is about (a profile, a DM). The entry then applies
   * only if that ship is the owner's bot.
   */
  forShip?: string | null;
  /** Whether to show the entry before the first answer is in. */
  whileLoading?: boolean;
} = {}): {
  botShip: string;
  visible: boolean;
  /** The bot's tasks by id, once it has shared them. */
  tasks?: Record<string, StewardAutomationTask>;
  count?: number;
} {
  // The node's desk decides whether there are task screens to enter. Until
  // its version is known the entries stay hidden, so they do not show and
  // then go on a node too old for them.
  const deskSupportsTasks = store.useDeskSupportsAutomations() === true;
  const currentUserId = useCurrentUserId();
  const botShip = api.getBotUserIdForUser(currentUserId);
  const on =
    deskSupportsTasks &&
    enabled &&
    Boolean(botShip) &&
    (forShip === undefined || api.isBotUserIdForUser(forShip, currentUserId));
  const query = useStewardAutomationTasks(on);
  const { refetch } = query;
  // The screens these entries sit on stay mounted, so each asks the node
  // again when it comes back into view, hidden entry or not: a node that had
  // no scheduled tasks last time may have them now.
  useFocusEffect(
    useCallback(() => {
      if (on) refetchAutomationsOnFocus(refetch);
    }, [on, refetch])
  );
  const tasks = on ? tasksForShip(query.data, botShip) : undefined;
  return {
    botShip,
    visible: on && offersScheduledTasks(query, { whileLoading }),
    tasks,
    count: tasks ? Object.keys(tasks).length : undefined,
  };
}

/** Opens the task list, pushed on a phone and swapped in beside a sidebar. */
export function useOpenScheduledTasks() {
  const navigation = useNavigation();
  const isWindowNarrow = useIsWindowNarrow();
  return useCallback(
    (
      params: { botShip: string; groupId?: string },
      /**
       * For a screen whose own navigator has no task list, as a group's
       * details have beside a sidebar: the list opens in this channel's
       * stack, the way the group's settings screens do.
       */
      inChannelId?: string
    ) => {
      // Going by the navigator rather than the window: a wide tablet still
      // has the phone's single stack, with the list in it.
      const listIsHere = navigation
        .getState()
        ?.routeNames.includes('ScheduledTasks');
      if (!listIsHere && inChannelId) {
        navigation.navigate('Channel' as any, {
          channelId: inChannelId,
          groupId: params.groupId,
          screen: 'ScheduledTasks',
          pop: true,
          params,
        });
        return;
      }
      if (isWindowNarrow) {
        navigation.dispatch(StackActions.push('ScheduledTasks', params));
        return;
      }
      navigation.navigate('ScheduledTasks', params);
    },
    [isWindowNarrow, navigation]
  );
}
