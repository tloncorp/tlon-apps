import { Pressable } from '@tloncorp/ui';
import { useEffect, useState } from 'react';
import { SizableText, XStack, YStack } from 'tamagui';

import {
  type AgentTaskRow,
  AgentTaskRows,
} from '../ui/components/AgentTaskRows';
import {
  AGENT_TASK_DEMO_TICKS,
  buildAgentTaskDemoRows,
  getAgentTaskDemoAutoExpandedId,
} from '../ui/components/AgentTaskRows/demo';
import { FixtureWrapper } from './FixtureWrapper';

function useDemoTick() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let currentTick = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const advance = () => {
      if (currentTick >= AGENT_TASK_DEMO_TICKS.length) return;
      timer = setTimeout(() => {
        currentTick += 1;
        setTick(currentTick);
        advance();
      }, AGENT_TASK_DEMO_TICKS[currentTick]);
    };

    advance();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  return tick;
}

function VariantToggle({
  value,
  onChange,
}: {
  value: 'capsules' | 'list';
  onChange: (value: 'capsules' | 'list') => void;
}) {
  return (
    <XStack
      alignSelf="flex-start"
      padding="$2xs"
      borderRadius="$xl"
      backgroundColor="$secondaryBackground"
      gap="$2xs"
    >
      {(['capsules', 'list'] as const).map((variant) => {
        const active = value === variant;
        return (
          <Pressable
            key={variant}
            role="button"
            aria-pressed={active}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(variant)}
            cursor="pointer"
            minHeight={44}
            alignItems="center"
            paddingHorizontal="$l"
            borderRadius="$xl"
            backgroundColor={active ? '$background' : 'transparent'}
            hoverStyle={{ backgroundColor: '$background' }}
            pressStyle={{ opacity: 0.7 }}
          >
            <SizableText
              size="$xs"
              color={active ? '$primaryText' : '$secondaryText'}
              textTransform="capitalize"
            >
              {variant}
            </SizableText>
          </Pressable>
        );
      })}
    </XStack>
  );
}

function AgentTaskRowsFixture() {
  const [variant, setVariant] = useState<'capsules' | 'list'>('capsules');
  const tick = useDemoTick();

  return (
    <FixtureWrapper fillWidth fillHeight verticalAlign="top">
      <YStack
        width="100%"
        maxWidth={520}
        alignSelf="center"
        padding="$xl"
        gap="$xl"
      >
        <YStack gap="$xs">
          <SizableText size="$l" color="$primaryText">
            Agent turn activity
          </SizableText>
          <SizableText size="$s" color="$secondaryText">
            Progress stays legible while the agent works. Open any row for the
            underlying activity.
          </SizableText>
        </YStack>
        <VariantToggle value={variant} onChange={setVariant} />
        <AgentTaskRows
          rows={buildAgentTaskDemoRows(tick)}
          variant={variant}
          autoExpandedId={getAgentTaskDemoAutoExpandedId(tick)}
          testID="agent-task-rows"
        />
      </YStack>
    </FixtureWrapper>
  );
}

// The three states AC #5 cares about, held still rather than animated
// through, so each can be inspected on its own.
const STATIC_ROWS: AgentTaskRow[] = [
  {
    id: 'context',
    title: 'Assembled context',
    status: 'completed',
    sequence: 1,
    meta: 'ready',
    details: [{ label: 'Detail', value: '3 messages, 1 attachment' }],
  },
  {
    id: 'tools',
    title: 'Checking the web',
    status: 'running',
    sequence: 2,
    meta: '2 calls',
  },
  {
    id: 'delivery',
    title: 'Run failed',
    status: 'failed',
    sequence: 3,
    meta: 'timed out',
    details: [{ label: 'Detail', value: 'No reply within 60s' }],
  },
];

function AgentTaskRowsStatesFixture() {
  return (
    <FixtureWrapper fillWidth fillHeight>
      <YStack padding="$xl" gap="$l" backgroundColor="$secondaryBackground">
        <YStack gap="$xs">
          <SizableText size="$l" color="$primaryText">
            Row states
          </SizableText>
          <SizableText size="$s" color="$secondaryText">
            Completed, running, and failed. The failed row is pressable here
            because a retry handler is supplied; without one it renders with no
            retry affordance.
          </SizableText>
        </YStack>
        <AgentTaskRows
          rows={STATIC_ROWS}
          variant="list"
          onRetry={(row) => alert(`retry ${row.id}`)}
          testID="agent-task-rows-states"
        />
      </YStack>
    </FixtureWrapper>
  );
}

export default {
  animated: <AgentTaskRowsFixture />,
  states: <AgentTaskRowsStatesFixture />,
};
