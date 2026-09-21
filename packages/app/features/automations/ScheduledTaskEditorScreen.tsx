import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';

import type { RootStackParamList } from '../../navigation/types';
import {
  type RecurringTaskDraft,
  RecurringTaskEditorView,
  ScheduledTasksNotice,
} from '../../ui/components/RecurringTasks';
import { formatAutomationSchedule } from '../../ui/components/formatAutomationSchedule';
import {
  tasksForShip,
  useStewardAutomationTasks,
} from './useStewardAutomationTasks';

type Props = NativeStackScreenProps<RootStackParamList, 'ScheduledTaskEditor'>;

const emptyDraft: RecurringTaskDraft = {
  name: '',
  prompt: '',
  repeat: 'Weekly',
  selectedDays: [1, 2, 3, 4, 5],
  timeLabel: '7:00 AM',
  destinationLabel: 'Not available',
  enabled: true,
};

export function ScheduledTaskEditorScreen({ navigation, route }: Props) {
  const query = useStewardAutomationTasks();
  useFocusEffect(
    useCallback(() => {
      void query.refetch();
    }, [query.refetch])
  );
  const task = route.params.taskId
    ? tasksForShip(query.data, route.params.botShip)[route.params.taskId]
    : undefined;
  const initialDraft = useMemo<RecurringTaskDraft>(
    () =>
      task
        ? {
            ...emptyDraft,
            name: task.name || task.description || 'Untitled task',
            prompt: task.payload?.message || task.description || '',
            scheduleLabel: formatAutomationSchedule(task),
            enabled: task.enabled !== false,
          }
        : emptyDraft,
    [task]
  );
  const [draftOverride, setDraftOverride] = useState<RecurringTaskDraft | null>(
    null
  );
  const draft = draftOverride ?? initialDraft;

  if (query.isLoading) {
    return (
      <ScheduledTasksNotice
        title="Loading scheduled task"
        body="Reading the latest definition mirrored to Steward."
        onBack={navigation.goBack}
      />
    );
  }

  if (query.isError && !query.data?.available) {
    return (
      <ScheduledTasksNotice
        title="Could not load scheduled task"
        body="Check your connection and try again."
        action={{ label: 'Try again', onPress: () => void query.refetch() }}
        onBack={navigation.goBack}
      />
    );
  }

  if (!query.data?.available) {
    return (
      <ScheduledTasksNotice
        title="Scheduled tasks unavailable"
        body="This ship does not expose Steward's automation mirror yet."
        onBack={navigation.goBack}
      />
    );
  }

  if (route.params.taskId && !task) {
    return (
      <ScheduledTasksNotice
        title="Scheduled task not found"
        body="This task may have been removed since the list was loaded."
        action={{ label: 'Refresh', onPress: () => void query.refetch() }}
        onBack={navigation.goBack}
      />
    );
  }

  return (
    <RecurringTaskEditorView
      draft={draft}
      readOnly
      onChange={setDraftOverride}
      onBack={navigation.goBack}
    />
  );
}
