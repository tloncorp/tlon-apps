import { Button, LoadingSpinner, Pressable } from '@tloncorp/ui';
import { SizableText, View, XStack, YStack } from 'tamagui';

import { formatDuration, pluralize } from './Channel/ContextLens/format';
import {
  type LensMessageTarget,
  RunInspector,
} from './Channel/ContextLens/RunInspector';
import { RunSummary } from './Channel/ContextLens/RunSummary';
import type { ContextLens } from './Channel/ContextLens/types';
import { COLUMN_WIDTH } from './RecurringTasks';
import { ScreenHeader } from './ScreenHeader';
import { ScreenScrollView } from './ScreenScrollView';
import {
  TASK_RUN_OUTCOME_COLORS,
  TASK_RUN_OUTCOME_LABELS,
  formatRunDay,
  formatRunTime,
  groupRunsByDay,
  isTestRun,
  taskRunError,
  taskRunOutcome,
  taskRunOutput,
} from './taskRuns';

function SectionLabel({ children }: { children: string }) {
  return (
    <SizableText
      size="$s"
      color="$tertiaryText"
      textTransform="uppercase"
      letterSpacing={0}
    >
      {children}
    </SizableText>
  );
}

function TestTag() {
  return (
    <View
      backgroundColor="$border"
      borderRadius="$xl"
      paddingHorizontal="$s"
      paddingVertical={1}
    >
      <SizableText size="$xs" color="$secondaryText">
        Test
      </SizableText>
    </View>
  );
}

function Notice({
  title,
  body,
  loading = false,
  onRetry,
}: {
  title: string;
  body?: string;
  loading?: boolean;
  onRetry?: () => void;
}) {
  return (
    <YStack
      alignItems="center"
      justifyContent="center"
      minHeight={180}
      gap="$m"
      borderWidth={1}
      borderColor="$border"
      borderRadius="$m"
      backgroundColor="$secondaryBackground"
      padding="$m"
    >
      {loading ? <LoadingSpinner color="$secondaryText" /> : null}
      <SizableText size="$m" color="$secondaryText" textAlign="center">
        {title}
      </SizableText>
      {body ? (
        <SizableText size="$s" color="$tertiaryText" textAlign="center">
          {body}
        </SizableText>
      ) : null}
      {onRetry ? (
        <Button preset="secondaryOutline" label="Try again" onPress={onRetry} />
      ) : null}
    </YStack>
  );
}

/** A failed refresh over runs already on screen, which may be out of date. */
function RefreshFailed({ onRetry }: { onRetry?: () => void }) {
  return (
    <XStack
      alignItems="center"
      justifyContent="space-between"
      gap="$m"
      borderWidth={1}
      borderColor="$border"
      borderRadius="$m"
      backgroundColor="$secondaryBackground"
      paddingHorizontal="$m"
      paddingVertical="$s"
      testID="TaskRunHistoryRefreshFailed"
    >
      <SizableText size="$s" color="$secondaryText" flex={1}>
        Could not refresh runs. These may be out of date.
      </SizableText>
      {onRetry ? (
        <Button
          preset="secondaryOutline"
          size="small"
          label="Try again"
          onPress={onRetry}
        />
      ) : null}
    </XStack>
  );
}

/**
 * One scheduled task's runs as a timeline, newest first and cut into days,
 * each run a stop on the line coloured by how it went.
 */
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
  const days = groupRunsByDay(runs, now);
  const count = Math.max(total ?? 0, runs.length);
  return (
    <YStack flex={1} backgroundColor="$background">
      <ScreenHeader
        title="Run history"
        backAction={onBack}
        borderBottom
        placement="navigation"
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
      />
      <ScreenScrollView showsVerticalScrollIndicator={false}>
        <YStack
          gap="$l"
          padding="$l"
          paddingBottom="$2xl"
          width="100%"
          maxWidth={COLUMN_WIDTH}
          alignSelf="center"
        >
          {error && runs.length ? <RefreshFailed onRetry={onRetry} /> : null}
          {taskName || runs.length ? (
            <YStack gap="$2xs">
              {taskName ? (
                <SizableText size="$l" color="$primaryText">
                  {taskName}
                </SizableText>
              ) : null}
              {runs.length ? (
                <SizableText size="$s" color="$secondaryText">
                  {pluralize(count, 'run')}
                </SizableText>
              ) : null}
            </YStack>
          ) : null}
          {days.map((day) => (
            <YStack key={day.key} gap="$s">
              <SectionLabel>{day.label}</SectionLabel>
              <YStack>
                {day.runs.map((lens, index) => (
                  <TaskRunTimelineItem
                    key={lens.lensId}
                    lens={lens}
                    isLast={index === day.runs.length - 1}
                    onPress={() => onPressRun(lens)}
                  />
                ))}
              </YStack>
            </YStack>
          ))}
          {!runs.length ? (
            error ? (
              <Notice
                title="Could not load runs"
                body="Check your connection and try again."
                onRetry={onRetry}
              />
            ) : loading ? (
              <Notice title="Loading runs" loading />
            ) : (
              <Notice
                title="No runs yet"
                body="Runs show up here after the task runs on its schedule, or after you test it."
              />
            )
          ) : null}
          {hasMore && onLoadMore ? (
            <Button
              preset="secondaryOutline"
              label={loadingMore ? 'Loading…' : 'Show older runs'}
              disabled={loadingMore}
              onPress={onLoadMore}
              centered
              testID="TaskRunHistoryLoadMore"
            />
          ) : null}
        </YStack>
      </ScreenScrollView>
    </YStack>
  );
}

function TaskRunTimelineItem({
  lens,
  isLast,
  onPress,
}: {
  lens: ContextLens;
  isLast: boolean;
  onPress: () => void;
}) {
  const outcome = taskRunOutcome(lens);
  const color = TASK_RUN_OUTCOME_COLORS[outcome];
  // One paragraph, so a reply that opens with a short line still previews
  // its substance.
  const preview = (
    outcome === 'failed'
      ? (taskRunError(lens) ?? taskRunOutput(lens))
      : taskRunOutput(lens)
  )
    ?.replace(/\s+/g, ' ')
    .trim();
  const meta = [
    outcome === 'running' ? null : formatDuration(lens.lifecycle.durationMs),
    lens.tools.callCount ? pluralize(lens.tools.callCount, 'tool call') : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <XStack gap="$s" alignItems="stretch">
      <YStack alignItems="center" width={14}>
        <View
          width={9}
          height={9}
          borderRadius={999}
          marginTop={14}
          backgroundColor={color}
        />
        {!isLast ? (
          <View flex={1} width={1} marginTop="$2xs" backgroundColor="$border" />
        ) : null}
      </YStack>
      <Pressable
        flex={1}
        onPress={onPress}
        cursor="pointer"
        pressStyle={{ opacity: 0.6 }}
        marginBottom={isLast ? 0 : '$s'}
        testID={`TaskRun-${lens.lensId}`}
      >
        <YStack
          gap="$2xs"
          borderWidth={1}
          borderColor="$border"
          borderRadius="$s"
          paddingHorizontal="$m"
          paddingVertical="$s"
          backgroundColor={
            outcome === 'running' ? '$secondaryBackground' : '$background'
          }
        >
          <XStack alignItems="center" justifyContent="space-between" gap="$s">
            <XStack alignItems="center" gap="$s" flex={1} minWidth={0}>
              <SizableText size="$s" color="$primaryText">
                {formatRunTime(lens.createdAt)}
              </SizableText>
              <SizableText size="$s" color={color} numberOfLines={1}>
                {TASK_RUN_OUTCOME_LABELS[outcome]}
              </SizableText>
              {isTestRun(lens) ? <TestTag /> : null}
            </XStack>
            {outcome === 'running' ? (
              <LoadingSpinner size="small" color="$secondaryText" />
            ) : null}
          </XStack>
          {preview ? (
            <SizableText size="$s" color="$secondaryText" numberOfLines={2}>
              {preview}
            </SizableText>
          ) : null}
          {meta ? (
            <SizableText size="$xs" color="$tertiaryText">
              {meta}
            </SizableText>
          ) : null}
        </YStack>
      </Pressable>
    </XStack>
  );
}

/**
 * One run of a scheduled task: what it produced first, then the run itself
 * laid out the way Context Lens lays out any bot run.
 */
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
  const test = lens ? isTestRun(lens) : false;
  return (
    <YStack flex={1} backgroundColor="$background">
      <ScreenHeader
        title={test ? 'Test run' : 'Run'}
        backAction={onBack}
        borderBottom
        placement="navigation"
      />
      <ScreenScrollView showsVerticalScrollIndicator={false}>
        <YStack
          gap="$m"
          padding="$l"
          paddingBottom="$2xl"
          width="100%"
          maxWidth={COLUMN_WIDTH}
          alignSelf="center"
        >
          {lens ? (
            <>
              <TaskRunOutputCard
                lens={lens}
                now={now}
                destinationLabel={destinationLabel}
              />
              <RunSummary lens={lens} />
              <RunInspector
                lens={lens}
                onPressMessage={onPressMessage}
                omitOutput={test}
              />
            </>
          ) : (
            <Notice
              title={loading ? 'Loading run' : 'Run not found'}
              body={
                loading
                  ? undefined
                  : 'Runs sync from your ship. This one may not have arrived yet.'
              }
              loading={loading}
            />
          )}
        </YStack>
      </ScreenScrollView>
    </YStack>
  );
}

function TaskRunOutputCard({
  lens,
  now,
  destinationLabel,
}: {
  lens: ContextLens;
  now: number;
  destinationLabel?: string;
}) {
  const outcome = taskRunOutcome(lens);
  const output = taskRunOutput(lens);
  const error = outcome === 'failed' ? taskRunError(lens) : null;
  const note = isTestRun(lens)
    ? 'Test run. Nothing was posted and the schedule is unchanged.'
    : destinationLabel
      ? `Posted to ${destinationLabel}.`
      : null;
  return (
    <YStack
      gap="$s"
      borderWidth={1}
      borderColor="$border"
      borderRadius="$m"
      padding="$m"
      backgroundColor="$secondaryBackground"
      testID="TaskRunOutput"
    >
      <XStack alignItems="center" justifyContent="space-between" gap="$s">
        <SectionLabel>Output</SectionLabel>
        <SizableText size="$s" color={TASK_RUN_OUTCOME_COLORS[outcome]}>
          {TASK_RUN_OUTCOME_LABELS[outcome]}
        </SizableText>
      </XStack>
      <SizableText size="$s" color="$secondaryText">
        {[
          `${formatRunDay(lens.createdAt, now)}, ${formatRunTime(lens.createdAt)}`,
          outcome === 'running'
            ? null
            : formatDuration(lens.lifecycle.durationMs),
        ]
          .filter(Boolean)
          .join(' · ')}
      </SizableText>
      {outcome === 'running' ? (
        <XStack alignItems="center" gap="$s">
          <LoadingSpinner size="small" color="$secondaryText" />
          <SizableText size="$s" color="$secondaryText" flex={1}>
            Your bot is working on it. The output shows here when it finishes.
          </SizableText>
        </XStack>
      ) : output ? (
        <SizableText size="$m" color="$primaryText" selectable>
          {output}
        </SizableText>
      ) : error ? null : (
        <SizableText size="$s" color="$secondaryText">
          {outcome === 'no-output'
            ? 'The task finished without producing anything to post.'
            : 'No output was recorded for this run.'}
        </SizableText>
      )}
      {error ? (
        <SizableText size="$s" color="$negativeActionText">
          {error}
        </SizableText>
      ) : null}
      {note ? (
        <SizableText size="$s" color="$tertiaryText">
          {note}
        </SizableText>
      ) : null}
    </YStack>
  );
}
