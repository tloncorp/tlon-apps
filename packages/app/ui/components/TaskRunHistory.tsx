import { useCallback, useState } from 'react';

import { findLensOutputPost } from './Channel/ContextLens/lensPost';
import type { LensMessageTarget } from './Channel/ContextLens/runFacts';
import type {
  ContextLens,
  ContextLensOutput,
} from './Channel/ContextLens/types';
import {
  SETTINGS_LIST_COLUMN_WIDTH,
  SettingsListScreenView,
} from './SettingsList';
import {
  taskRunDetailSections,
  taskRunHistorySections,
} from './taskRunSections';
import { isTestRun } from './taskRuns';

/** One scheduled task's runs, newest first and cut into days. */
export function TaskRunHistoryView({
  taskName,
  runs,
  total,
  now,
  loading = false,
  error = false,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  onPressRun,
  onBack,
  onRetry,
  test,
}: {
  taskName?: string;
  runs: ContextLens[];
  /** How many runs the owner's ship holds, which can exceed those loaded. */
  total?: number;
  now: number;
  loading?: boolean;
  error?: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  onPressRun: (lens: ContextLens) => void;
  onBack: () => void;
  /** Asks the ship for the runs again after a failed load. */
  onRetry?: () => void;
  /** A test run of the task, offered from the header. */
  test?: { busy: boolean; disabled?: boolean; onPress: () => void };
}) {
  return (
    <SettingsListScreenView
      title="Run history"
      loading={loading && !error && !runs.length}
      sections={taskRunHistorySections({
        taskName,
        runs,
        total,
        now,
        error,
        hasMore,
        loadingMore,
        onLoadMore,
        onPressRun,
        onRetry,
      })}
      rightActions={
        test
          ? [
              {
                id: 'test-scheduled-task',
                text: test.busy ? 'Starting…' : 'Test run',
                onPress: test.onPress,
                disabled: test.busy || test.disabled,
              },
            ]
          : undefined
      }
      maxWidth={SETTINGS_LIST_COLUMN_WIDTH}
      onBackPressed={onBack}
      showsBackOnWideWindows
    />
  );
}

/** One run of a scheduled task: what it produced, then the run itself. */
export function TaskRunDetailView({
  lens,
  loading = false,
  now,
  destinationLabel,
  onPressMessage,
  onBack,
}: {
  lens: ContextLens | null;
  loading?: boolean;
  now: number;
  /** Where this run posted, as the run recorded it. */
  destinationLabel?: string;
  onPressMessage?: (target: LensMessageTarget) => void;
  onBack: () => void;
}) {
  const [expandedTools, setExpandedTools] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const toggleTool = useCallback((toolRunId: string) => {
    setExpandedTools((current) => {
      const next = new Set(current);
      if (!next.delete(toolRunId)) {
        next.add(toolRunId);
      }
      return next;
    });
  }, []);
  // A post the run sent opens once it has synced; until then there is
  // nothing to open.
  const pressOutput = useCallback(
    async (output: ContextLensOutput) => {
      const post = await findLensOutputPost(output);
      if (post && onPressMessage) {
        onPressMessage({
          postId: post.id,
          channelId: output.conversationId,
          parentId: post.parentId ?? undefined,
        });
      }
    },
    [onPressMessage]
  );

  return (
    <SettingsListScreenView
      title={lens && isTestRun(lens) ? 'Test run' : 'Run'}
      loading={loading && !lens}
      sections={
        lens
          ? taskRunDetailSections({
              lens,
              now,
              destinationLabel,
              expandedTools,
              onToggleTool: toggleTool,
              onPressMessage,
              onPressOutput: onPressMessage ? pressOutput : undefined,
            })
          : [
              {
                key: 'missing',
                footer:
                  'Runs sync from your ship. This one may not have arrived yet.',
                rows: [{ key: 'missing', title: 'Run not found' }],
              },
            ]
      }
      maxWidth={SETTINGS_LIST_COLUMN_WIDTH}
      onBackPressed={onBack}
      showsBackOnWideWindows
    />
  );
}
