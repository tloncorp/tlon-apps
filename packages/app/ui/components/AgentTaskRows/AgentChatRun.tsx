import { Icon, Pressable } from '@tloncorp/ui';
import { useEffect, useMemo, useState } from 'react';
import { SizableText, XStack, YStack } from 'tamagui';

import { effectiveLensStatus } from '../Channel/ContextLens/format';
import type {
  ContextLensEvent,
  ContextLensStatus,
} from '../Channel/ContextLens/types';
import { useContactName } from '../ContactNameV2';
import {
  AgentRunTimer,
  formatAgentRunElapsedTime,
  resolveAgentRunTimerStartedAt,
} from './AgentRunTimer';
import { AgentTaskRows } from './AgentTaskRows';
import {
  buildAgentTaskRowsFromActivity,
  compactWaitingTaskRows,
} from './activityRows';
import { agentChatWaitingLabel } from './activitySemantics';
import { activateAgentControlFromKeyboard } from './keyboardControl';
import { agentChatRunOutcome } from './runOutcome';
import {
  type AgentChatReceiptOutcome,
  useAgentChatReceiptOutcome,
} from './useAgentChatReceiptOutcome';

const CHAT_AGENT_RUN_MAX_WIDTH = 656;

function runActivityEvents(
  event: ContextLensEvent,
  events: ContextLensEvent[]
) {
  return events.flatMap((candidate) => {
    const activity = candidate.detail?.activity;
    return candidate.lens.lensId === event.lens.lensId && activity
      ? [activity]
      : [];
  });
}

function statusLabel(status: ContextLensStatus) {
  if (status === 'assembling' || status === 'queued') return 'Preparing';
  if (status === 'delivering') return 'Replying';
  return 'Working';
}

function durationLabel(durationMs: number | null) {
  if (durationMs == null) return null;
  const seconds = Math.max(1, Math.round(durationMs / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

function finalRunLabel(
  event: ContextLensEvent,
  outcome: AgentChatReceiptOutcome = agentChatRunOutcome(event)
) {
  if (outcome === 'waiting') return agentChatWaitingLabel(event);
  if (outcome === 'finishing') return 'Finishing';
  if (outcome === 'incomplete') return 'Finished';
  if (outcome === 'unavailable') return 'Activity unavailable';
  const status = effectiveLensStatus(event.lens);
  if (status === 'completed') return 'Completed';
  if (status === 'no_reply') return 'Finished without a reply';
  if (status === 'timed_out') return 'Timed out';
  if (status === 'aborted') return 'Stopped';
  return 'Failed';
}

function finalRunSucceeded(event: ContextLensEvent) {
  return agentChatRunOutcome(event) !== 'failed';
}

function failureDescription(event: ContextLensEvent, completedActions: number) {
  const status = effectiveLensStatus(event.lens);
  const preserved = completedActions
    ? ` ${completedActions} completed ${completedActions === 1 ? 'action was' : 'actions were'} preserved.`
    : '';
  if (status === 'timed_out') {
    const limit = durationLabel(event.lens.lifecycle.timeoutMs);
    return `The agent reached its${limit ? ` ${limit}` : ''} limit before replying.${preserved}`;
  }
  if (status === 'no_reply') {
    return `The agent finished without posting a reply.${preserved}`;
  }
  if (status === 'aborted') {
    return `The run stopped before a reply was posted.${preserved}`;
  }
  return `The agent couldn’t finish this request.${preserved}`;
}

export function AgentChatLiveRun({
  event,
  events,
  onPressActivity,
}: {
  event: ContextLensEvent;
  events: ContextLensEvent[];
  onPressActivity?: () => void;
}) {
  const model = useMemo(
    () =>
      buildAgentTaskRowsFromActivity(
        event.lens.activity,
        runActivityEvents(event, events),
        {
          toolRuns: event.lens.tools.runs,
          includeToolArguments: event.lens.visibility === 'owner',
          runOutcome: 'active',
          presentation: 'chat',
          waitingLabel: agentChatWaitingLabel(event),
        }
      ),
    [event, events]
  );
  const planLead =
    event.lens.activity?.plan?.title ?? event.lens.activity?.plan?.explanation;
  const botShip = event.lens.botShip;
  const requesterShip = event.lens.triggerDetails?.authorShip;
  const botName = useContactName(botShip ?? '~zod');
  const requesterName = useContactName(requesterShip ?? botShip ?? '~zod');
  const runStatus = statusLabel(event.lens.status);
  const timerStartedAt = resolveAgentRunTimerStartedAt(
    event.lens.lifecycle.dispatchStartedAt,
    event.lens.createdAt
  );
  const attribution =
    event.lens.chatType === 'channel' && requesterShip
      ? `${runStatus} on ${requesterName}’s request`
      : runStatus;

  if (!model.rows.length) return null;

  return (
    <YStack
      aria-live="polite"
      width="100%"
      maxWidth={CHAT_AGENT_RUN_MAX_WIDTH}
      gap="$m"
      paddingLeft="$4xl"
      paddingRight="$l"
      paddingTop="$m"
      paddingBottom="$s"
      testID="agent-chat-live-run"
    >
      <XStack minHeight={44} alignItems="center" gap="$s" flexWrap="wrap">
        <XStack
          height={24}
          maxWidth="100%"
          minWidth={0}
          alignItems="center"
          gap="$xs"
          paddingHorizontal="$s"
          borderRadius="$xl"
          backgroundColor="$secondaryBackground"
        >
          <SizableText
            size="$xs"
            color="$secondaryText"
            flexShrink={1}
            minWidth={0}
            numberOfLines={1}
          >
            ⟐ {botShip ? botName : 'Agent'} {attribution}
          </SizableText>
          <SizableText size="$xs" color="$secondaryText">
            ·
          </SizableText>
          <AgentRunTimer startedAt={timerStartedAt} />
        </XStack>
        {onPressActivity ? (
          <Pressable
            onPress={onPressActivity}
            onKeyDown={(event) =>
              activateAgentControlFromKeyboard(event, onPressActivity)
            }
            role="button"
            tabIndex={0}
            aria-label="Open agent activity"
            minHeight={44}
            paddingHorizontal="$s"
            borderRadius="$xl"
            hoverStyle={{ backgroundColor: '$secondaryBackground' }}
            pressStyle={{ opacity: 0.68 }}
            focusVisibleStyle={{
              outlineColor: '$primaryText',
              outlineOffset: 2,
              outlineStyle: 'solid',
              outlineWidth: 2,
            }}
          >
            <XStack minHeight={44} alignItems="center" gap="$2xs">
              <SizableText size="$xs" color="$secondaryText">
                Activity
              </SizableText>
              <Icon type="ChevronRight" size="$s" color="$secondaryText" />
            </XStack>
          </Pressable>
        ) : null}
      </XStack>
      {planLead ? (
        <SizableText size="$s" color="$secondaryText">
          {planLead}
        </SizableText>
      ) : null}
      <AgentTaskRows
        rows={model.rows}
        autoExpandedId={model.autoExpandedId}
        testID="agent-chat-live-tasks"
      />
    </YStack>
  );
}

export function AgentChatActivityReceipt({
  event,
  events,
  onContinue,
  continuationStarted = false,
}: {
  event: ContextLensEvent;
  events: ContextLensEvent[];
  onContinue?: () => Promise<void> | void;
  /** A child Lens with retryOf pointing at this run has appeared. */
  continuationStarted?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showQueuedSteps, setShowQueuedSteps] = useState(false);
  const [continueState, setContinueState] = useState<
    'idle' | 'pending' | 'requested' | 'started' | 'error'
  >('idle');
  const botShip = event.lens.botShip;
  const botName = useContactName(botShip ?? '~zod');
  const sourceOutcome = agentChatRunOutcome(event);
  const outcome = useAgentChatReceiptOutcome(event, sourceOutcome);
  const waitingLabel = agentChatWaitingLabel(event);
  const model = useMemo(() => {
    return buildAgentTaskRowsFromActivity(
      event.lens.activity,
      runActivityEvents(event, events),
      {
        toolRuns: event.lens.tools.runs,
        includeToolArguments: event.lens.visibility === 'owner',
        // A final reply can arrive before the final Lens snapshot. Keep that
        // older plan live-looking instead of inventing task completion.
        runOutcome: outcome === 'finishing' ? 'active' : outcome,
        presentation: 'chat',
        failureMessage: event.lens.error,
        waitingLabel,
      }
    );
  }, [event, events, outcome, waitingLabel]);
  const waitingProjection = compactWaitingTaskRows(model.rows);
  const queuedCount = outcome === 'waiting' ? waitingProjection.queuedCount : 0;
  const visibleRows =
    outcome === 'waiting' && !showQueuedSteps
      ? waitingProjection.rows
      : model.rows;
  const expandable = visibleRows.length > 0;
  const succeeded = finalRunSucceeded(event);
  const count = model.rows.length;
  const incompleteCount = model.rows.filter(
    (row) => row.status !== 'completed'
  ).length;
  const completedActions =
    event.lens.tools.runs?.filter((run) => run.status === 'completed').length ??
    0;
  const duration =
    event.lens.lifecycle.durationMs == null
      ? null
      : formatAgentRunElapsedTime(event.lens.lifecycle.durationMs);
  const finishingTimerStartedAt =
    outcome === 'finishing' && duration == null
      ? resolveAgentRunTimerStartedAt(
          event.lens.lifecycle.dispatchStartedAt,
          event.lens.createdAt
        )
      : undefined;
  const summary = [
    botShip ? botName : null,
    finalRunLabel(event, outcome),
    outcome === 'waiting'
      ? queuedCount
        ? `${queuedCount} queued`
        : '1 response'
      : outcome === 'incomplete'
        ? `${incompleteCount} incomplete`
        : count
          ? `${count} ${count === 1 ? 'task' : 'tasks'}`
          : null,
    duration,
  ]
    .filter(Boolean)
    .join(' · ');

  useEffect(() => {
    if (continuationStarted) {
      setContinueState('started');
    }
  }, [continuationStarted]);

  useEffect(() => {
    if (continueState !== 'requested') return;
    const timer = setTimeout(() => setContinueState('error'), 15_000);
    return () => clearTimeout(timer);
  }, [continueState]);

  const handleContinue = async () => {
    if (
      !onContinue ||
      continueState === 'pending' ||
      continueState === 'requested' ||
      continueState === 'started'
    ) {
      return;
    }
    setContinueState('pending');
    try {
      await onContinue();
      setContinueState((state) =>
        state === 'started' || continuationStarted ? 'started' : 'requested'
      );
    } catch {
      setContinueState('error');
    }
  };

  return (
    <YStack
      width="100%"
      maxWidth={CHAT_AGENT_RUN_MAX_WIDTH}
      gap="$m"
      paddingLeft="$4xl"
      paddingRight="$l"
      paddingTop="$s"
      paddingBottom="$s"
      testID="agent-chat-activity-receipt"
    >
      <Pressable
        onPress={expandable ? () => setExpanded((value) => !value) : undefined}
        onKeyDown={
          expandable
            ? (event) =>
                activateAgentControlFromKeyboard(event, () =>
                  setExpanded((value) => !value)
                )
            : undefined
        }
        role={expandable ? 'button' : undefined}
        tabIndex={expandable ? 0 : undefined}
        aria-expanded={expandable ? expanded : undefined}
        aria-label={
          expandable
            ? `${summary}. ${expanded ? 'Hide' : 'View'} activity`
            : summary
        }
        disabled={!expandable}
        cursor={expandable ? 'pointer' : 'default'}
        alignSelf="flex-start"
        maxWidth="100%"
        minHeight={44}
        paddingHorizontal="$m"
        borderRadius="$xl"
        backgroundColor="$secondaryBackground"
        hoverStyle={expandable ? { opacity: 0.82 } : undefined}
        pressStyle={expandable ? { opacity: 0.68 } : undefined}
        focusVisibleStyle={
          expandable
            ? {
                outlineColor: '$primaryText',
                outlineOffset: 2,
                outlineStyle: 'solid',
                outlineWidth: 2,
              }
            : undefined
        }
      >
        <XStack minHeight={44} alignItems="center" gap="$s" minWidth={0}>
          <Icon
            type={
              outcome === 'completed'
                ? 'Checkmark'
                : outcome === 'waiting' || outcome === 'finishing'
                  ? 'Clock'
                  : outcome === 'incomplete'
                    ? 'Info'
                    : outcome === 'unavailable'
                      ? 'Info'
                      : 'Close'
            }
            size="$s"
            color={
              outcome === 'completed'
                ? '$positiveActionText'
                : outcome === 'waiting' ||
                    outcome === 'finishing' ||
                    outcome === 'incomplete' ||
                    outcome === 'unavailable'
                  ? '$secondaryText'
                  : '$negativeActionText'
            }
          />
          <SizableText
            size="$xs"
            color="$secondaryText"
            flexShrink={1}
            minWidth={0}
            numberOfLines={1}
          >
            {summary}
          </SizableText>
          {finishingTimerStartedAt !== undefined ? (
            <>
              <SizableText size="$xs" color="$secondaryText" flexShrink={0}>
                ·
              </SizableText>
              <AgentRunTimer startedAt={finishingTimerStartedAt} />
            </>
          ) : null}
          {expandable ? (
            <>
              <SizableText size="$xs" color="$secondaryText" flexShrink={0}>
                {expanded ? 'Hide' : 'View activity'}
              </SizableText>
              <Icon
                type={expanded ? 'ChevronDown' : 'ChevronRight'}
                size="$s"
                color="$secondaryText"
              />
            </>
          ) : null}
        </XStack>
      </Pressable>
      {expanded && expandable ? (
        <YStack gap="$s">
          {outcome === 'unavailable' ? (
            <SizableText
              size="$xs"
              color="$secondaryText"
              paddingHorizontal="$s"
            >
              Activity details unavailable
            </SizableText>
          ) : null}
          <AgentTaskRows
            rows={visibleRows}
            variant="list"
            autoExpandedId={model.autoExpandedId}
            testID="agent-chat-completed-tasks"
          />
          {outcome === 'waiting' && model.rows.length > 1 ? (
            <XStack
              minHeight={44}
              alignItems="center"
              justifyContent="space-between"
              gap="$m"
              paddingHorizontal="$s"
            >
              <SizableText size="$xs" color="$secondaryText" flexShrink={1}>
                {queuedCount
                  ? `${queuedCount} ${queuedCount === 1 ? 'step' : 'steps'} queued ${waitingLabel === 'Waiting for approval' ? 'after approval' : 'after your answer'}`
                  : `${model.rows.length - 1} other plan ${model.rows.length === 2 ? 'step' : 'steps'}`}
              </SizableText>
              <Pressable
                onPress={() => setShowQueuedSteps((value) => !value)}
                onKeyDown={(event) =>
                  activateAgentControlFromKeyboard(event, () =>
                    setShowQueuedSteps((value) => !value)
                  )
                }
                role="button"
                tabIndex={0}
                aria-label={
                  showQueuedSteps
                    ? 'Hide queued plan steps'
                    : 'View queued plan steps'
                }
                minHeight={44}
                paddingHorizontal="$s"
                borderRadius="$xl"
                pressStyle={{ opacity: 0.68 }}
                focusVisibleStyle={{
                  outlineColor: '$primaryText',
                  outlineOffset: 2,
                  outlineStyle: 'solid',
                  outlineWidth: 2,
                }}
              >
                <XStack minHeight={44} alignItems="center" gap="$2xs">
                  <SizableText size="$xs" color="$secondaryText">
                    {showQueuedSteps ? 'Hide plan' : 'View plan'}
                  </SizableText>
                  <Icon
                    type={showQueuedSteps ? 'ChevronUp' : 'ChevronDown'}
                    size="$s"
                    color="$secondaryText"
                  />
                </XStack>
              </Pressable>
            </XStack>
          ) : null}
        </YStack>
      ) : null}
      {!succeeded ? (
        <YStack gap="$s" paddingHorizontal="$s">
          <SizableText size="$s" lineHeight={20} color="$secondaryText">
            {failureDescription(event, completedActions)}
          </SizableText>
          {onContinue ? (
            <XStack alignItems="center" gap="$m" flexWrap="wrap">
              <Pressable
                onPress={handleContinue}
                onKeyDown={(event) =>
                  activateAgentControlFromKeyboard(event, handleContinue)
                }
                role="button"
                tabIndex={
                  continueState === 'pending' ||
                  continueState === 'requested' ||
                  continueState === 'started'
                    ? -1
                    : 0
                }
                disabled={
                  continueState === 'pending' ||
                  continueState === 'requested' ||
                  continueState === 'started'
                }
                aria-disabled={
                  continueState === 'pending' ||
                  continueState === 'requested' ||
                  continueState === 'started'
                }
                aria-label="Continue this agent request"
                minHeight={44}
                paddingHorizontal="$l"
                borderRadius="$xl"
                backgroundColor="$primaryText"
                opacity={
                  continueState === 'requested' || continueState === 'started'
                    ? 0.56
                    : 1
                }
                pressStyle={{ opacity: 0.72 }}
                focusVisibleStyle={{
                  outlineColor: '$primaryText',
                  outlineOffset: 2,
                  outlineStyle: 'solid',
                  outlineWidth: 2,
                }}
              >
                <XStack minHeight={44} alignItems="center" gap="$s">
                  <SizableText size="$s" color="$background">
                    {continueState === 'pending'
                      ? 'Requesting…'
                      : continueState === 'requested'
                        ? 'Continuation requested'
                        : continueState === 'started'
                          ? 'Continuation started'
                          : 'Continue'}
                  </SizableText>
                  {continueState === 'idle' || continueState === 'error' ? (
                    <Icon type="ChevronRight" size="$s" color="$background" />
                  ) : null}
                </XStack>
              </Pressable>
              {continueState === 'error' ? (
                <SizableText size="$xs" color="$negativeActionText">
                  Couldn’t reach the agent. Try again.
                </SizableText>
              ) : null}
            </XStack>
          ) : null}
        </YStack>
      ) : null}
    </YStack>
  );
}
