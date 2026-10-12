import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import * as api from '@tloncorp/api';
import * as store from '@tloncorp/shared/store';
import { useCallback, useMemo, useState } from 'react';

import {
  type ContextLens,
  lensFromRunPayload,
} from '../../ui/components/Channel/ContextLens/types';

/**
 * One scheduled task's runs. The owner's ship keeps them as lens runs; the
 * newest page is fetched into the local store on focus and older pages on
 * request, and runs that arrive on the lens feed meanwhile, a test run's
 * progress included, show up as they land.
 */
export function useTaskRuns({
  botShip,
  taskId,
  enabled = true,
}: {
  botShip: string;
  taskId: string | undefined;
  enabled?: boolean;
}) {
  const supported = store.useDeskSupportsTaskRuns() === true;
  const jobId = taskId ?? '';
  const on = enabled && supported && Boolean(taskId);
  const { data: rows } = store.useCronJobRuns({ botShip, jobId });
  const page = useQuery({
    queryKey: ['cronJobRunsPage', botShip, jobId],
    queryFn: () => store.syncCronJobRuns({ botShip, jobId }),
    enabled: on,
  });
  const { refetch } = page;
  useFocusEffect(
    useCallback(() => {
      if (on) void refetch({ cancelRefetch: false });
    }, [on, refetch])
  );

  const runs = useMemo<ContextLens[]>(
    () =>
      (rows ?? [])
        .flatMap((row) => {
          const lens = lensFromRunPayload(row.payload);
          return lens ? [lens] : [];
        })
        .sort((a, b) => b.createdAt - a.createdAt),
    [rows]
  );

  // Older pages continue from the last page the ship sent, not from the
  // oldest run the store holds: a run cached some other way, as opening a
  // message's lens does, would make the next page skip everything between.
  // Kept per task, since a desktop screen stays mounted across tasks, and
  // per fetch of the first page: a refreshed first page may not reach the
  // older pages already loaded, so paging starts again from it.
  const taskKey = `${botShip}/${jobId}`;
  const firstPageAt = page.dataUpdatedAt;
  const [olderPages, setOlderPages] = useState<{
    taskKey: string;
    firstPageAt: number;
    hasMore: boolean;
    cursor?: string;
  } | null>(null);
  const older =
    olderPages?.taskKey === taskKey && olderPages.firstPageAt === firstPageAt
      ? olderPages
      : null;
  const cursor = older ? older.cursor : page.data?.cursor;
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMore = useCallback(async () => {
    if (!on || !cursor) return;
    setLoadingMore(true);
    try {
      const next = await store.syncCronJobRuns({
        botShip,
        jobId,
        before: cursor,
      });
      setOlderPages({
        taskKey,
        firstPageAt,
        hasMore: next.hasMore,
        cursor: next.cursor ?? cursor,
      });
    } finally {
      setLoadingMore(false);
    }
  }, [botShip, cursor, firstPageAt, jobId, on, taskKey]);

  return {
    supported,
    runs,
    total: page.data?.total,
    loading: page.isLoading,
    error: page.isError,
    hasMore: older ? older.hasMore : (page.data?.hasMore ?? false),
    loadingMore,
    loadMore,
    retry: () => void refetch(),
  };
}

/**
 * The time, read again each time the screen comes into view: enough for
 * "Today" and "Yesterday" without a clock ticking under every render.
 */
export function useNowOnFocus() {
  const [now, setNow] = useState(Date.now);
  useFocusEffect(useCallback(() => setNow(Date.now()), []));
  return now;
}

/**
 * Starts a test run of one of the bot's tasks and resolves with the lens run
 * recording it, once the bot has it under way.
 */
export function useStartTestRun(botShip: string) {
  return useCallback(
    async (taskId: string) => {
      try {
        const { lensId } = await api.testAutomation({
          bot: botShip,
          id: taskId,
        });
        return lensId;
      } catch (error) {
        // The owner's ship gives the bot 20 seconds; a busy bot may still be
        // listing its jobs. Its answer lands on the request.
        if (error instanceof api.StewardAutomationPendingError) {
          const { lensId } = await api.awaitAutomationRequest(error.requestId, {
            attempts: 15,
          });
          if (lensId) return lensId;
        }
        throw error;
      }
    },
    [botShip]
  );
}
