import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/store';
import { useCallback, useMemo } from 'react';

import type { RootStackParamList } from '../../navigation/types';
import { useGroupTitle, useIsWindowNarrow } from '../../ui';
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
  const { botShip, groupId } = route.params;
  const isWindowNarrow = useIsWindowNarrow();
  const query = useStewardAutomationTasks();
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => refetchAutomationsOnFocus(refetch), [refetch])
  );
  // Opened from a group, the list holds only what posts into that group.
  const { data: group } = store.useGroup({ id: groupId });
  const groupTitle = useGroupTitle(group);
  const tasks = useMemo<IdentifiedAutomationTask[]>(() => {
    const all = tasksForShip(query.data, botShip) ?? {};
    const shown = groupId
      ? tasksPostingTo(
          all,
          new Set(group?.channels?.map((channel) => channel.id))
        )
      : all;
    return Object.entries(shown).map(([id, task]) => ({ id, task }));
  }, [query.data, botShip, groupId, group?.channels]);
  const openEditor = useCallback(
    (taskId?: string) => {
      // A task started from a group's list should post to that group.
      const params = { botShip, taskId, groupId: taskId ? undefined : groupId };
      if (isWindowNarrow) {
        navigation.push('ScheduledTaskEditor', params);
        return;
      }
      navigation.navigate('ScheduledTaskEditor', params);
    },
    [botShip, groupId, isWindowNarrow, navigation]
  );

  // Beside a sidebar, a group's list was opened from the group's details,
  // which sit outside this stack, so going back means going there. Where
  // the details are in this same stack, as on a phone or a tablet, back is
  // just back.
  const goBack = useCallback(() => {
    const parent = navigation.getParent();
    const detailsAreOutside = !navigation
      .getState()
      .routeNames.includes('ChatDetails');
    if (groupId && detailsAreOutside && parent) {
      parent.navigate('ChatDetails', { chatType: 'group', chatId: groupId });
      return;
    }
    navigation.goBack();
  }, [groupId, navigation]);

  return (
    <ScheduledTasksScreenView
      available={query.data?.available ?? false}
      synced={tasksForShip(query.data, botShip) !== undefined}
      error={query.isError && !query.data?.available}
      loading={query.isLoading}
      tasks={tasks}
      scope={groupId ? (groupTitle ?? 'this group') : undefined}
      onBack={goBack}
      onRetry={() => void refetch()}
      onAddTask={() => openEditor()}
      onPressTask={({ id }) => openEditor(id)}
    />
  );
}
