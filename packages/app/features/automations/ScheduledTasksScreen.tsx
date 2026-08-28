import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsWindowNarrow } from '@tloncorp/ui';
import { useMemo } from 'react';

import type { RootStackParamList } from '../../navigation/types';
import {
  type IdentifiedAutomationTask,
  ScheduledTasksScreenView,
} from '../../ui/components/RecurringTasks';
import {
  tasksForShip,
  useStewardAutomationTasks,
} from './useStewardAutomationTasks';

type Props = NativeStackScreenProps<RootStackParamList, 'ScheduledTasks'>;

export function ScheduledTasksScreen({ navigation, route }: Props) {
  const isWindowNarrow = useIsWindowNarrow();
  const query = useStewardAutomationTasks();
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
      loading={query.isLoading}
      tasks={tasks}
      canMutate={false}
      onBack={navigation.goBack}
      onPressTask={({ id }) =>
        // Desktop registers this screen in a Drawer, which cannot handle the
        // stack-only PUSH action.
        isWindowNarrow
          ? navigation.push('ScheduledTaskEditor', {
              botShip: route.params.botShip,
              taskId: id,
            })
          : navigation.navigate('ScheduledTaskEditor', {
              botShip: route.params.botShip,
              taskId: id,
            })
      }
    />
  );
}
