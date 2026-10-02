import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo } from 'react';

import type { RootStackParamList } from '../../navigation/types';
import { useIsWindowNarrow } from '../../ui';
import {
  type IdentifiedAutomationTask,
  ScheduledTasksScreenView,
} from '../../ui/components/RecurringTasks';
import {
  refetchAutomationsOnFocus,
  tasksForShip,
  useStewardAutomationTasks,
} from './useStewardAutomationTasks';

type Props = NativeStackScreenProps<RootStackParamList, 'ScheduledTasks'>;

export function ScheduledTasksScreen({ navigation, route }: Props) {
  const { botShip } = route.params;
  const isWindowNarrow = useIsWindowNarrow();
  const query = useStewardAutomationTasks();
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => refetchAutomationsOnFocus(refetch), [refetch])
  );
  const tasks = useMemo<IdentifiedAutomationTask[]>(
    () =>
      Object.entries(tasksForShip(query.data, botShip) ?? {}).map(
        ([id, task]) => ({ id, task })
      ),
    [query.data, botShip]
  );
  const openEditor = useCallback(
    (taskId?: string) => {
      const params = { botShip, taskId };
      if (isWindowNarrow) {
        navigation.push('ScheduledTaskEditor', params);
        return;
      }
      navigation.navigate('ScheduledTaskEditor', params);
    },
    [botShip, isWindowNarrow, navigation]
  );

  return (
    <ScheduledTasksScreenView
      available={query.data?.available ?? false}
      synced={tasksForShip(query.data, botShip) !== undefined}
      error={query.isError && !query.data?.available}
      loading={query.isLoading}
      tasks={tasks}
      onBack={navigation.goBack}
      onRetry={() => void refetch()}
      onAddTask={() => openEditor()}
      onPressTask={({ id }) => openEditor(id)}
    />
  );
}
