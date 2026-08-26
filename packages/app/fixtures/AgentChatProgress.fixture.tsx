import { Icon, Pressable } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutAnimation, Platform, UIManager } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { ScrollView, SizableText, XStack, YStack } from 'tamagui';

import {
  type AgentTaskRow,
  AgentTaskRows,
} from '../ui/components/AgentTaskRows';
import { TextAvatar } from '../ui/components/Avatar';
import { FixtureWrapper } from './FixtureWrapper';

const FINAL_PHASE = 6;
const PHASE_DURATIONS = [1_200, 1_800, 2_200, 2_400, 2_000, 900] as const;

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function buildRunRows(phase: number): AgentTaskRow[] {
  const citiesSelected = phase >= 2;
  const currentCollected = phase >= 3;
  const historyCollected = phase >= 4;
  const comparisonCompleted = phase >= 5;
  const answerCompleted = phase >= FINAL_PHASE;

  return [
    {
      id: 'select-cities',
      sequence: 1,
      title: 'Choose cities and comparison date',
      subtitle: citiesSelected
        ? '10 cities selected · comparison date fixed'
        : 'Selecting a representative set across Asia',
      status: citiesSelected ? 'completed' : 'running',
      progress: citiesSelected ? undefined : 0.28,
      details: [
        {
          label: 'Latest update',
          value: citiesSelected
            ? 'Using ten cities across East, South, and Southeast Asia.'
            : 'Choosing cities with usable current and historical coverage.',
        },
      ],
    },
    {
      id: 'current-weather',
      sequence: 2,
      title: 'Collect current conditions',
      subtitle: currentCollected
        ? '10/10 cities checked'
        : citiesSelected
          ? '6/10 cities checked · Mumbai next'
          : 'Not started',
      status: currentCollected
        ? 'completed'
        : citiesSelected
          ? 'running'
          : 'pending',
      meta: citiesSelected ? '10 actions' : undefined,
      details: [
        {
          label: 'Latest update',
          value: currentCollected
            ? 'Current conditions are available for all ten cities.'
            : 'Checking temperature, conditions, and observation time.',
        },
        {
          label: 'Actions',
          value: currentCollected
            ? '10 weather lookups completed'
            : '6 weather lookups completed · 1 running',
        },
      ],
    },
    {
      id: 'historical-weather',
      sequence: 3,
      title: 'Find comparable historical records',
      subtitle: historyCollected
        ? '9 direct records · 1 documented proxy'
        : currentCollected
          ? 'Checking archive coverage for Seoul and Mumbai'
          : 'Not started',
      status: historyCollected
        ? 'completed'
        : currentCollected
          ? 'running'
          : 'pending',
      meta: currentCollected ? '10 actions' : undefined,
      details: [
        {
          label: 'Latest update',
          value: historyCollected
            ? 'Daily observations were incomplete for one city, so the nearest defensible archive was used and labeled.'
            : 'Checking daily archives and noting gaps rather than hiding them.',
        },
        {
          label: 'Actions',
          value: historyCollected
            ? '10 archive lookups completed'
            : '4 archive lookups completed · 1 running',
        },
      ],
    },
    {
      id: 'compare-weather',
      sequence: 4,
      title: 'Normalize and compare the results',
      subtitle: comparisonCompleted
        ? 'Units normalized · differences calculated'
        : historyCollected
          ? 'Aligning units, dates, and source quality'
          : 'Not started',
      status: comparisonCompleted
        ? 'completed'
        : historyCollected
          ? 'running'
          : 'pending',
      details: [
        {
          label: 'Latest update',
          value: comparisonCompleted
            ? 'The comparison is ready with source limitations preserved.'
            : 'Normalizing temperature units and separating exact records from proxies.',
        },
      ],
    },
    {
      id: 'write-answer',
      sequence: 5,
      title: 'Write the answer',
      subtitle: answerCompleted
        ? 'Comparison posted'
        : comparisonCompleted
          ? 'Summarizing the strongest comparisons and caveats'
          : 'Not started',
      status: answerCompleted
        ? 'completed'
        : comparisonCompleted
          ? 'running'
          : 'pending',
      details: [
        {
          label: 'Latest update',
          value: answerCompleted
            ? 'The final comparison includes all ten cities and clearly labels the proxy record.'
            : 'Writing a concise city-by-city comparison with sources.',
        },
      ],
    },
  ];
}

function activeTaskId(phase: number) {
  if (phase === 1) return 'select-cities';
  if (phase === 2) return 'current-weather';
  if (phase === 3) return 'historical-weather';
  if (phase === 4) return 'compare-weather';
  if (phase === 5) return 'write-answer';
  return undefined;
}

function commentaryForPhase(phase: number) {
  return phase < FINAL_PHASE
    ? 'Comparing current weather in 10 Asian cities with records from 90 years ago.'
    : 'The comparison is complete.';
}

function Author({
  name,
  avatar,
  isBot = false,
  status,
}: {
  name: string;
  avatar: string;
  isBot?: boolean;
  status?: string;
}) {
  return (
    <XStack alignItems="center" gap="$l" paddingHorizontal="$l">
      <TextAvatar
        text={avatar}
        size="$2xl"
        rounded
        backgroundColor={isBot ? '$yellow' : '$secondaryBackground'}
      />
      <XStack flex={1} alignItems="center" gap="$m" minWidth={0}>
        <SizableText size="$m" color="$primaryText" numberOfLines={1}>
          {name}
        </SizableText>
        {isBot ? (
          <XStack
            height={20}
            alignItems="center"
            paddingHorizontal="$s"
            borderRadius="$xl"
            backgroundColor="$secondaryBackground"
          >
            <SizableText size="$xs" color="$secondaryText">
              Bot
            </SizableText>
          </XStack>
        ) : null}
        {status ? (
          <SizableText size="$xs" color="$tertiaryText" numberOfLines={1}>
            {status}
          </SizableText>
        ) : null}
      </XStack>
    </XStack>
  );
}

function UserRequest() {
  return (
    <YStack gap="$xs">
      <Author name="You" avatar="Y" status="now" />
      <SizableText
        size="$s"
        color="$primaryText"
        paddingLeft="$4xl"
        paddingRight="$l"
      >
        Tell me the weather in 10 Asian cities, then compare it with the same
        day 90 years ago.
      </SizableText>
    </YStack>
  );
}

function LiveRunCard({ phase }: { phase: number }) {
  const rows = useMemo(() => buildRunRows(phase), [phase]);

  return (
    <YStack gap="$m" accessibilityLiveRegion="polite">
      <Author name="BackupBot" avatar="B" isBot status="Working" />
      <YStack paddingLeft="$4xl" paddingRight="$l" gap="$m">
        <SizableText size="$s" color="$secondaryText" minHeight={38}>
          {commentaryForPhase(phase)}
        </SizableText>
        <AgentTaskRows
          rows={rows}
          autoExpandedId={activeTaskId(phase)}
          testID="agent-chat-live-tasks"
        />
      </YStack>
    </YStack>
  );
}

function ActivityReceipt({
  expanded,
  onPress,
}: {
  expanded: boolean;
  onPress: () => void;
}) {
  return (
    <YStack gap="$m">
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel="Completed five steps in forty two seconds. View activity"
        alignSelf="flex-start"
        minHeight={36}
        paddingHorizontal="$m"
        borderRadius="$xl"
        backgroundColor="$secondaryBackground"
        hoverStyle={{ opacity: 0.82 }}
        pressStyle={{ opacity: 0.68 }}
      >
        <XStack minHeight={36} alignItems="center" gap="$s">
          <Icon type="Checkmark" size="$s" color="$positiveActionText" />
          <SizableText size="$xs" color="$secondaryText">
            Completed 5 steps · 42s
          </SizableText>
          <SizableText size="$xs" color="$tertiaryText">
            {expanded ? 'Hide' : 'View activity'}
          </SizableText>
          <Icon
            type={expanded ? 'ChevronDown' : 'ChevronRight'}
            size="$s"
            color="$tertiaryText"
          />
        </XStack>
      </Pressable>
      {expanded ? (
        <AgentTaskRows
          rows={buildRunRows(FINAL_PHASE)}
          variant="list"
          expandedIds={[]}
          testID="agent-chat-completed-tasks"
        />
      ) : null}
    </YStack>
  );
}

function FinalReply({
  receiptExpanded,
  onToggleReceipt,
}: {
  receiptExpanded: boolean;
  onToggleReceipt: () => void;
}) {
  return (
    <YStack gap="$xs" accessibilityLiveRegion="polite">
      <Author name="BackupBot" avatar="B" isBot status="now" />
      <YStack paddingLeft="$4xl" paddingRight="$l" gap="$m">
        <SizableText size="$s" color="$primaryText">
          I compared current conditions across ten Asian cities with the closest
          defensible records from the same date 90 years ago. Nine cities had
          direct daily records; one uses a clearly labeled historical proxy.
        </SizableText>
        <ActivityReceipt expanded={receiptExpanded} onPress={onToggleReceipt} />
      </YStack>
    </YStack>
  );
}

function Composer() {
  return (
    <XStack
      alignItems="center"
      gap="$m"
      paddingHorizontal="$l"
      paddingVertical="$m"
      borderTopWidth={1}
      borderColor="$border"
      backgroundColor="$background"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add attachment"
        width={40}
        height={40}
        borderRadius="$xl"
        alignItems="center"
        justifyContent="center"
        backgroundColor="$secondaryBackground"
        pressStyle={{ opacity: 0.7 }}
      >
        <Icon type="Add" size="$m" color="$primaryText" />
      </Pressable>
      <XStack
        flex={1}
        minHeight={42}
        alignItems="center"
        paddingHorizontal="$l"
        borderRadius="$xl"
        backgroundColor="$secondaryBackground"
      >
        <SizableText size="$s" color="$tertiaryText">
          Message BackupBot
        </SizableText>
      </XStack>
    </XStack>
  );
}

function AgentChatProgressFixture() {
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState(0);
  const [runKey, setRunKey] = useState(0);
  const [receiptExpanded, setReceiptExpanded] = useState(false);

  useEffect(() => {
    if (phase >= FINAL_PHASE) return;
    const timer = setTimeout(
      () => setPhase((current) => current + 1),
      PHASE_DURATIONS[phase]
    );
    return () => clearTimeout(timer);
  }, [phase, runKey]);

  useEffect(() => {
    if (reducedMotion) return;
    LayoutAnimation.configureNext({
      duration: 240,
      create: {
        type: LayoutAnimation.Types.easeOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: { type: LayoutAnimation.Types.easeOut },
      delete: {
        type: LayoutAnimation.Types.easeOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });
  }, [phase, receiptExpanded, reducedMotion]);

  const replay = useCallback(() => {
    setReceiptExpanded(false);
    setPhase(0);
    setRunKey((current) => current + 1);
  }, []);

  return (
    <FixtureWrapper fillWidth fillHeight verticalAlign="top" safeArea>
      <YStack flex={1} backgroundColor="$background">
        <XStack
          minHeight={56}
          alignItems="center"
          justifyContent="space-between"
          paddingHorizontal="$l"
          borderBottomWidth={1}
          borderColor="$border"
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            width={40}
            height={40}
            alignItems="flex-start"
            justifyContent="center"
            pressStyle={{ opacity: 0.6 }}
          >
            <Icon type="ChevronLeft" size="$m" color="$primaryText" />
          </Pressable>
          <YStack alignItems="center" gap="$2xs">
            <SizableText size="$m" color="$primaryText">
              BackupBot
            </SizableText>
            <SizableText size="$xs" color="$tertiaryText">
              Agent chat prototype
            </SizableText>
          </YStack>
          <Pressable
            onPress={replay}
            accessibilityRole="button"
            accessibilityLabel="Replay agent turn"
            width={40}
            height={40}
            alignItems="flex-end"
            justifyContent="center"
            pressStyle={{ opacity: 0.6 }}
          >
            <Icon type="Refresh" size="$m" color="$primaryText" />
          </Pressable>
        </XStack>

        <ScrollView
          flex={1}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'flex-end',
            paddingTop: 24,
            paddingBottom: 28,
            gap: 28,
          }}
        >
          <UserRequest />
          <YStack key={runKey} minHeight={phase === 0 ? 0 : 252}>
            {phase === 0 ? null : phase < FINAL_PHASE ? (
              <LiveRunCard phase={phase} />
            ) : (
              <FinalReply
                receiptExpanded={receiptExpanded}
                onToggleReceipt={() => setReceiptExpanded((value) => !value)}
              />
            )}
          </YStack>
        </ScrollView>

        <Composer />
      </YStack>
    </FixtureWrapper>
  );
}

export default <AgentChatProgressFixture />;
