import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/store';
import { useEffect, useMemo, useState } from 'react';

import type { RootStackParamList } from '../../navigation/types';
import { lensFromRunPayload } from '../../ui/components/Channel/ContextLens/types';
import { TaskRunDetailView } from '../../ui/components/TaskRunHistory';
import { useLensMessageNavigation } from '../lens/useLensMessageNavigation';
import {
  tasksForShip,
  useStewardAutomationTasks,
} from './useStewardAutomationTasks';
import { useNowOnFocus } from './useTaskRuns';

type Props = NativeStackScreenProps<RootStackParamList, 'ScheduledTaskRun'>;

// A test run just asked for reaches the owner's ship over the bot's lens
// sync, a moment after the bot answers. Look for it for this long.
const STARTING_ATTEMPTS = 15;
const STARTING_INTERVAL_MS = 2_000;

export function ScheduledTaskRunScreen({ navigation, route }: Props) {
  const { botShip, taskId, lensId, starting } = route.params;

  const [resolving, setResolving] = useState(true);
  useEffect(() => {
    let cancelled = false;
    // Holds the pending wait's cancel rather than its id: web and native
    // type a timer id differently.
    let cancelWait: (() => void) | undefined;
    setResolving(true);
    // db-first, then the owner ship; caching the result re-renders the
    // query below, as do the run's later updates on the lens feed
    const look = async () => {
      const attempts = starting ? STARTING_ATTEMPTS : 1;
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        const found = await store.ensureContextLensRun({ botShip, lensId });
        if (cancelled) return;
        if (found || attempt === attempts) break;
        await new Promise<void>((resolve) => {
          const id = setTimeout(resolve, STARTING_INTERVAL_MS);
          cancelWait = () => clearTimeout(id);
        });
        if (cancelled) return;
      }
      setResolving(false);
    };
    void look();
    return () => {
      cancelled = true;
      cancelWait?.();
    };
  }, [botShip, lensId, starting]);

  const runQuery = store.useContextLensRun({ botShip, lensId });
  const lens = useMemo(
    () => (runQuery.data ? lensFromRunPayload(runQuery.data.payload) : null),
    [runQuery.data]
  );

  // Where a scheduled run of this task posts, to say where its output went.
  const { data } = useStewardAutomationTasks();
  const to = tasksForShip(data, botShip)?.[taskId]?.delivery?.to;
  const { data: channel } = store.useChannel({
    id: to?.includes('/') ? to : undefined,
  });
  const destinationLabel = channel
    ? [channel.group?.title, channel.title].filter(Boolean).join(' · ') ||
      undefined
    : undefined;

  const handlePressMessage = useLensMessageNavigation(botShip);
  const now = useNowOnFocus();

  return (
    <TaskRunDetailView
      lens={lens}
      loading={runQuery.isLoading || (resolving && !lens)}
      now={now}
      destinationLabel={destinationLabel}
      onPressMessage={handlePressMessage}
      onBack={navigation.goBack}
    />
  );
}
