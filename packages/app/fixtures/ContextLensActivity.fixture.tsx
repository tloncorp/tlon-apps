import { Pressable } from '@tloncorp/ui';
import { useMemo, useState } from 'react';
import { ScrollView, SizableText, XStack, YStack } from 'tamagui';

import { RunInspector } from '../ui/components/Channel/ContextLens/RunInspector';
import type {
  ContextLens,
  ContextLensActivityEvent,
} from '../ui/components/Channel/ContextLens/types';
import { FixtureWrapper } from './FixtureWrapper';

const STARTED_AT = 1_787_001_200_000;

function buildLens(completed: boolean): ContextLens {
  const finishedAt = STARTED_AT + 42_000;
  return {
    lensId: 'lens-simulator-turn',
    runId: 'run-simulator-turn',
    messageId: 'message-simulator-turn',
    sessionKeyHash: 'fixture-session',
    chatType: 'channel',
    runKind: 'conversation',
    visibility: 'owner',
    trigger: 'mention',
    triggerDetails: {
      type: 'message',
      messageId: 'message-simulator-turn',
      authorShip: '~zod',
      conversationId: 'chat/~zod/context-lens-fixture',
      conversationKind: 'channel',
      receivedAt: STARTED_AT,
      preview: 'Show the progress of this agent turn in Messenger.',
    },
    model: 'gpt-5.6',
    provider: 'openai',
    status: completed ? 'completed' : 'tool_running',
    error: null,
    createdAt: STARTED_AT,
    updatedAt: completed ? finishedAt : STARTED_AT + 31_000,
    context: {
      currentMessage: true,
      threadMessages: 4,
      channelMessages: 12,
      citedPosts: 0,
      attachments: 0,
      pendingNudge: false,
      sources: [
        {
          kind: 'message',
          label: 'Current request',
          sourceId: 'message-simulator-turn',
          included: true,
          preview: 'Show the progress of this agent turn in Messenger.',
        },
        {
          kind: 'memory',
          label: 'Context Lens history',
          included: true,
          reason: 'Recent durable run context',
        },
      ],
    },
    activity: {
      schemaVersion: 1,
      eventCount: completed ? 9 : 7,
      lastEventAt: completed ? finishedAt : STARTED_AT + 31_000,
      truncated: false,
      plan: {
        title: 'Turn plan',
        explanation: 'Stable plan rows own commentary and tool updates.',
        updatedAt: completed ? finishedAt : STARTED_AT + 18_000,
        steps: [
          {
            id: 'plan-step-1',
            title: 'Inspect OpenClaw 7.1 events',
            status: 'completed',
          },
          {
            id: 'plan-step-2',
            title: 'Map commentary into stable rows',
            status: completed ? 'completed' : 'running',
          },
          {
            id: 'plan-step-3',
            title: 'Verify the result in Messenger',
            status: completed ? 'completed' : 'pending',
          },
        ],
      },
      items: [
        {
          id: 'commentary-1',
          kind: 'commentary',
          title: 'Preamble',
          status: 'completed',
          planStepId: 'plan-step-1',
          progressText:
            'The 7.1 host emits string plan steps and commentary preambles.',
          startedAt: STARTED_AT + 1_000,
          updatedAt: STARTED_AT + 7_000,
          completedAt: STARTED_AT + 7_000,
          source: 'codex-app-server',
        },
        {
          id: 'tool:read-events',
          kind: 'tool',
          title: 'Read agent events',
          name: 'agent.events',
          status: 'completed',
          planStepId: 'plan-step-1',
          progressText: 'Normalized the sanitized 7.1 event stream.',
          startedAt: STARTED_AT + 3_000,
          updatedAt: STARTED_AT + 8_000,
          completedAt: STARTED_AT + 8_000,
        },
        {
          id: 'commentary-2',
          kind: 'commentary',
          title: 'Preamble',
          status: 'completed',
          planStepId: 'plan-step-2',
          progressText: 'Attaching commentary and tools to the active row.',
          startedAt: STARTED_AT + 11_000,
          updatedAt: STARTED_AT + 19_000,
          completedAt: STARTED_AT + 19_000,
          source: 'codex-app-server',
        },
        {
          id: 'commentary-3',
          kind: 'commentary',
          title: 'Preamble',
          status: completed ? 'completed' : 'running',
          planStepId: 'plan-step-2',
          progressText: completed
            ? 'The activity rows are ready for the run inspector.'
            : 'Rendering the active task row in the run inspector.',
          startedAt: STARTED_AT + 21_000,
          updatedAt: completed ? finishedAt : STARTED_AT + 31_000,
          completedAt: completed ? finishedAt : null,
          source: 'codex-app-server',
        },
        {
          id: 'patch:activity-ui',
          kind: 'patch',
          title: 'Files changed',
          status: completed ? 'completed' : 'running',
          planStepId: 'plan-step-2',
          progressText: 'Context Lens activity UI',
          startedAt: STARTED_AT + 24_000,
          updatedAt: completed ? finishedAt : STARTED_AT + 30_000,
          completedAt: completed ? finishedAt : null,
          counts: { added: 4, modified: 3 },
        },
      ],
    },
    persistence: {
      postsReply: completed,
      updatesSettings: false,
      writesMedia: false,
      emitsTelemetry: false,
      cachesHistory: true,
      events: [
        {
          kind: 'conversation_state',
          action: 'updated',
          location: 'urbit',
          status: 'ok',
          key: '%steward/context-lens',
          at: completed ? finishedAt : STARTED_AT + 30_000,
        },
      ],
    },
    tools: {
      ownerOnlyAvailable: [],
      called: ['agent.events'],
      callCount: 1,
      lastStartedAt: STARTED_AT + 24_000,
      runs: [
        {
          id: 'tool-run-1',
          callIndex: 1,
          name: 'agent.events',
          phase: completed ? 'result' : 'update',
          startedAt: STARTED_AT + 24_000,
          completedAt: completed ? finishedAt : null,
          durationMs: completed ? 18_000 : null,
          status: completed ? 'completed' : 'running',
          argumentSummary: 'Subscribe to sanitized run activity',
          resultSummary: completed ? 'Activity stream closed' : undefined,
        },
      ],
    },
    outputs: completed
      ? [
          {
            messageId: 'message-output-1',
            conversationId: 'chat/~zod/context-lens-fixture',
            kind: 'channel',
            sentAt: finishedAt,
            preview: 'The task rows are now visible in Context Lens.',
          },
        ]
      : [],
    lifecycle: {
      queuedMs: 280,
      durationMs: completed ? 42_000 : null,
      timeoutMs: 300_000,
      timedOut: false,
      deliveredMessageCount: completed ? 1 : 0,
      queuedFinal: false,
      queuedFinalCount: 0,
      queuedBlockCount: 0,
    },
  };
}

const LIVE_ACTIVITY: readonly ContextLensActivityEvent[] = [
  {
    schemaVersion: 1,
    runId: 'run-simulator-turn',
    sequence: 8,
    occurredAt: STARTED_AT + 31_000,
    kind: 'command',
    phase: 'delta',
    retention: 'ephemeral',
    itemId: 'command:simulator-build',
    toolCallId: 'simulator-build',
    title: 'Simulator build',
    status: 'running',
    progressText: 'iOS bundle ready · rendering the live activity row',
  },
];

function ModeToggle({
  completed,
  onChange,
}: {
  completed: boolean;
  onChange: (completed: boolean) => void;
}) {
  return (
    <XStack
      padding="$2xs"
      borderRadius="$xl"
      backgroundColor="$secondaryBackground"
      gap="$2xs"
    >
      {[
        { label: 'Running', value: false },
        { label: 'Completed', value: true },
      ].map((option) => {
        const active = completed === option.value;
        return (
          <Pressable
            key={option.label}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            minHeight={36}
            justifyContent="center"
            paddingHorizontal="$m"
            borderRadius="$xl"
            backgroundColor={active ? '$background' : 'transparent'}
            pressStyle={{ opacity: 0.7 }}
          >
            <SizableText
              size="$xs"
              color={active ? '$primaryText' : '$secondaryText'}
            >
              {option.label}
            </SizableText>
          </Pressable>
        );
      })}
    </XStack>
  );
}

function ContextLensActivityFixture() {
  const [completed, setCompleted] = useState(false);
  const lens = useMemo(() => buildLens(completed), [completed]);

  return (
    <FixtureWrapper fillWidth fillHeight verticalAlign="top" safeArea>
      <YStack flex={1} backgroundColor="$background">
        <XStack
          alignItems="center"
          justifyContent="space-between"
          gap="$m"
          paddingHorizontal="$l"
          paddingVertical="$m"
          borderBottomWidth={1}
          borderColor="$border"
        >
          <YStack gap="$2xs" flex={1} minWidth={0}>
            <SizableText
              size="$xs"
              color="$tertiaryText"
              textTransform="uppercase"
            >
              Context Lens
            </SizableText>
            <SizableText size="$m" color="$primaryText">
              Simulated 7.1 run
            </SizableText>
          </YStack>
          <ModeToggle completed={completed} onChange={setCompleted} />
        </XStack>
        <ScrollView
          flex={1}
          contentContainerStyle={{ padding: 16, paddingBottom: 56 }}
        >
          <RunInspector
            lens={lens}
            activityEvents={completed ? [] : LIVE_ACTIVITY}
          />
        </ScrollView>
      </YStack>
    </FixtureWrapper>
  );
}

export default <ContextLensActivityFixture />;
