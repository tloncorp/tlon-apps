import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';

import type { RootStackParamList } from '../../navigation/types';
import { automationScheduleFields } from '../../ui/components/formatAutomationSchedule';
import {
  type RecurringTaskDraft,
  RecurringTaskEditorView,
} from '../../ui/components/RecurringTasks';
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
};

export function ScheduledTaskEditorScreen({ navigation, route }: Props) {
  const query = useStewardAutomationTasks();
  const task = route.params.taskId
    ? tasksForShip(query.data, route.params.botShip)[route.params.taskId]
    : undefined;
  const initialDraft = useMemo<RecurringTaskDraft>(() => {
    if (!task) return emptyDraft;
    // Only override the placeholder repeat/day/time fields when the schedule
    // can actually be represented; otherwise the card would assert a schedule
    // the task does not have.
    const schedule = automationScheduleFields(task);
    return {
      ...emptyDraft,
      ...schedule,
      name: task.name || task.description || 'Untitled task',
      prompt: task.payload?.message || task.description || '',
    };
  }, [task]);
  const [draftOverride, setDraftOverride] = useState<RecurringTaskDraft | null>(
    null
  );
  const draft = draftOverride ?? initialDraft;

  return (
    <RecurringTaskEditorView
      draft={draft}
      readOnly
      onChange={setDraftOverride}
      onBack={navigation.goBack}
    />
  );
}
