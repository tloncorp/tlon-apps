import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useToast } from '@tloncorp/ui';
import { useCallback, useRef, useState } from 'react';

import type { RootStackParamList } from '../../navigation/types';
import { useIsWindowNarrow } from '../../ui';
import type { ContextLens } from '../../ui/components/Channel/ContextLens/types';
import { TaskRunHistoryView } from '../../ui/components/TaskRunHistory';
import {
  canTestTask,
  describeTestRunError,
  taskStatus,
  taskTitle,
} from '../../ui/components/automationTaskDraft';
import { useNowOnFocus, useStartTestRun, useTaskRuns } from './useTaskRuns';
import {
  tasksForShip,
  useStewardAutomationTasks,
} from './useStewardAutomationTasks';

type Props = NativeStackScreenProps<RootStackParamList, 'ScheduledTaskRuns'>;

export function ScheduledTaskRunsScreen({ navigation, route }: Props) {
  const { botShip, taskId } = route.params;
  const isWindowNarrow = useIsWindowNarrow();
  const showToast = useToast();
  const { data } = useStewardAutomationTasks();
  const task = tasksForShip(data, botShip)?.[taskId];
  const history = useTaskRuns({ botShip, taskId });
  const now = useNowOnFocus();

  const openRun = useCallback(
    (lensId: string, starting?: boolean) => {
      const params = { botShip, taskId, lensId, starting };
      if (isWindowNarrow) {
        navigation.push('ScheduledTaskRun', params);
        return;
      }
      navigation.navigate('ScheduledTaskRun', params);
    },
    [botShip, isWindowNarrow, navigation, taskId]
  );

  const startTestRun = useStartTestRun(botShip);
  const [testing, setTesting] = useState(false);
  // A test can outlast its visit: the mounted screen can be left, and on
  // desktop shown again for another task, before the bot answers. What the
  // answer does to the screen belongs to the visit that asked for it.
  const visit = useRef(0);
  useFocusEffect(
    useCallback(() => {
      visit.current += 1;
      setTesting(false);
      return () => {
        visit.current += 1;
      };
    }, [])
  );
  const test = useCallback(async () => {
    const during = visit.current;
    setTesting(true);
    try {
      const lensId = await startTestRun(taskId);
      if (visit.current === during) openRun(lensId, true);
    } catch (error) {
      if (visit.current === during) {
        showToast({ message: describeTestRunError(error), duration: 4000 });
      }
    } finally {
      if (visit.current === during) setTesting(false);
    }
  }, [openRun, showToast, startTestRun, taskId]);

  return (
    <TaskRunHistoryView
      taskName={task ? taskTitle(task) : undefined}
      runs={history.runs}
      total={history.total}
      now={now}
      loading={history.loading}
      error={history.error}
      onRetry={history.retry}
      hasMore={history.hasMore}
      loadingMore={history.loadingMore}
      onLoadMore={() =>
        void history.loadMore().catch(() =>
          showToast({
            message: 'Could not load older runs. Try again.',
            duration: 4000,
          })
        )
      }
      onPressRun={(lens: ContextLens) => openRun(lens.lensId)}
      onBack={navigation.goBack}
      test={
        task && history.supported
          ? {
              busy: testing,
              disabled: taskStatus(task) === 'held' || !canTestTask(task),
              onPress: () => void test(),
            }
          : undefined
      }
    />
  );
}
