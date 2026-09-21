import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo } from 'react';

import type { RootStackParamList } from '../../navigation/types';
import {
  type IdentifiedAutomationTask,
  ScheduledTasksScreenView,
} from '../../ui/components/RecurringTasks';
import { useIsWindowNarrow } from '../../ui';
import {
  tasksForShip,
  useStewardAutomationTasks,
} from './useStewardAutomationTasks';

type Props = NativeStackScreenProps<RootStackParamList, 'ScheduledTasks'>;

export function ScheduledTasksScreen({ navigation, route }: Props) {
  const isWindowNarrow = useIsWindowNarrow();
  const query = useStewardAutomationTasks();
  useFocusEffect(
    useCallback(() => {
      void query.refetch();
    }, [query.refetch])
  );
  const tasks = useMemo<IdentifiedAutomationTask[]>(
    () =>
      Object.entries(tasksForShip(query.data, route.params.botShip)).map(
        ([id, task]) => ({ id, task })
      ),
    [query.data, route.params.botShip]
  );

  return (
    <ScheduledTasksScreenView
      available={query.data?.available ?? false}
      error={query.isError}
      loading={query.isLoading}
      tasks={tasks}
      canMutate={false}
      onBack={navigation.goBack}
      onRetry={() => void query.refetch()}
      onPressTask={({ id }) => {
        const params = {
          botShip: route.params.botShip,
          taskId: id,
        };
        if (isWindowNarrow) {
          navigation.push('ScheduledTaskEditor', params);
          return;
        }
        navigation.navigate('ScheduledTaskEditor', params);
      }}
    />
  );
}
