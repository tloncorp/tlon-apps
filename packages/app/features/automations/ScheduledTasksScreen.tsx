import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/store';
import { useCallback, useMemo } from 'react';

import type { RootStackParamList } from '../../navigation/types';
import { useChannelTitle, useGroupTitle, useIsWindowNarrow } from '../../ui';
import {
  type IdentifiedAutomationTask,
  ScheduledTasksScreenView,
} from '../../ui/components/RecurringTasks';
import { tasksPostingTo } from '../../ui/components/automationTaskDraft';
import {
  refetchAutomationsOnFocus,
  tasksForShip,
  useStewardAutomationTasks,
} from './useStewardAutomationTasks';

type Props = NativeStackScreenProps<RootStackParamList, 'ScheduledTasks'>;

export function ScheduledTasksScreen({ navigation, route }: Props) {
  const { botShip, groupId, channelId } = route.params;
  const isWindowNarrow = useIsWindowNarrow();
  const query = useStewardAutomationTasks();
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => refetchAutomationsOnFocus(refetch), [refetch])
  );
  // Opened from a group, the list holds only what posts into that group,
  // and opened from one of its channels, only what posts into that channel.
  const { data: group } = store.useGroup({ id: groupId });
  const groupTitle = useGroupTitle(group);
  const { data: channel } = store.useChannel({ id: channelId });
  const channelTitle = useChannelTitle(channel ?? null);
  const tasks = useMemo<IdentifiedAutomationTask[]>(() => {
    const all = tasksForShip(query.data, botShip) ?? {};
    const shown = channelId
      ? tasksPostingTo(all, new Set([channelId]))
      : groupId
        ? tasksPostingTo(all, new Set(group?.channels?.map(({ id }) => id)))
        : all;
    return Object.entries(shown).map(([id, task]) => ({ id, task }));
  }, [query.data, botShip, groupId, channelId, group?.channels]);
  const openEditor = useCallback(
    (taskId?: string) => {
      // A task started from a group's or a channel's list should post there.
      const startedFrom = taskId ? {} : { groupId, channelId };
      const params = { botShip, taskId, ...startedFrom };
      if (isWindowNarrow) {
        navigation.push('ScheduledTaskEditor', params);
        return;
      }
      navigation.navigate('ScheduledTaskEditor', params);
    },
    [botShip, groupId, channelId, isWindowNarrow, navigation]
  );

  // Beside a sidebar, a group's or a channel's list was opened from its
  // details, which sit outside this stack, so going back means going there.
  // Where the list was opened from inside this stack, back is just back: on
  // a phone or a tablet, or from a channel's info in the group's settings.
  const goBack = useCallback(() => {
    const parent = navigation.getParent();
    const { routes, index, routeNames } = navigation.getState();
    const detailsAreOutside = !routeNames.includes('ChatDetails');
    const cameFromGroupSettings = routes[index - 1]?.name === 'GroupSettings';
    const details = channelId
      ? ({ chatType: 'channel', chatId: channelId, groupId } as const)
      : groupId
        ? ({ chatType: 'group', chatId: groupId } as const)
        : undefined;
    if (details && detailsAreOutside && !cameFromGroupSettings && parent) {
      parent.navigate('ChatDetails', details);
      return;
    }
    navigation.goBack();
  }, [groupId, channelId, navigation]);

  return (
    <ScheduledTasksScreenView
      available={query.data?.available ?? false}
      synced={tasksForShip(query.data, botShip) !== undefined}
      error={query.isError && !query.data?.available}
      loading={query.isLoading}
      tasks={tasks}
      scope={
        channelId
          ? (channelTitle ?? 'this channel')
          : groupId
            ? (groupTitle ?? 'this group')
            : undefined
      }
      onBack={goBack}
      onRetry={() => void refetch()}
      onAddTask={() => openEditor()}
      onPressTask={({ id }) => openEditor(id)}
    />
  );
}
