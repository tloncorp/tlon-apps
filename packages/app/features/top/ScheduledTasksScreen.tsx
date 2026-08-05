import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import { syncCron } from '@tloncorp/shared/store';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, isWeb } from 'tamagui';

import type { RootStackParamList } from '../../navigation/types';
import type { AgentCron } from '../../ui';
import {
  AgentCronDetailScreenView,
  AgentCronDetailSheet,
  ScheduledTasksList,
  ScreenHeader,
  useIsWindowNarrow,
} from '../../ui';

type ScheduledTasksProps = NativeStackScreenProps<
  RootStackParamList,
  'ScheduledTasks'
>;

type ScheduledTaskProps = NativeStackScreenProps<
  RootStackParamList,
  'ScheduledTask'
>;

export function ScheduledTasksScreen({ navigation }: ScheduledTasksProps) {
  const cronState = db.agentCronState.useValue();
  const isWindowNarrow = useIsWindowNarrow();
  const [selectedCronId, setSelectedCronId] = useState<string | null>(null);

  useEffect(() => {
    syncCron().catch((error) => {
      console.warn('Failed to sync scheduled tasks', error);
    });
  }, []);

  const crons = useMemo(() => {
    return cronState.crons
      .filter((cron) => cron.status !== 'cancelled')
      .sort((a, b) => a.schedule.next - b.schedule.next);
  }, [cronState.crons]);

  const selectedCron = useMemo(() => {
    return crons.find((cron) => cron.id === selectedCronId) ?? null;
  }, [crons, selectedCronId]);

  const handlePressCron = useCallback(
    (cron: AgentCron) => {
      if (isWeb && !isWindowNarrow) {
        setSelectedCronId(cron.id);
        return;
      }

      navigation.navigate('ScheduledTask', { cronId: cron.id });
    },
    [isWindowNarrow, navigation]
  );

  const handleDetailOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setSelectedCronId(null);
    }
  }, []);

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        title="Scheduled Tasks"
        leftControls={
          <ScreenHeader.BackButton onPress={() => navigation.goBack()} />
        }
        borderBottom
      />
      <ScheduledTasksList
        crons={crons}
        onPressCron={handlePressCron}
        padding="$l"
      />
      <AgentCronDetailSheet
        open={selectedCronId !== null}
        onOpenChange={handleDetailOpenChange}
        cron={selectedCron}
        fallbackCronId={selectedCronId ?? undefined}
      />
    </View>
  );
}

export function ScheduledTaskScreen({ navigation, route }: ScheduledTaskProps) {
  const cronState = db.agentCronState.useValue();
  const cronId = route.params.cronId;
  const cron = useMemo(() => {
    return cronState.crons.find((candidate) => candidate.id === cronId) ?? null;
  }, [cronId, cronState.crons]);

  useEffect(() => {
    if (cron) {
      return;
    }

    syncCron().catch((error) => {
      console.warn('Failed to sync scheduled task', error);
    });
  }, [cron]);

  return (
    <AgentCronDetailScreenView
      cron={cron}
      fallbackCronId={cronId}
      onBackPress={() => navigation.goBack()}
    />
  );
}
