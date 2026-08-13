import type { A2UI } from '@tloncorp/shared/logic';
import { Button, Icon, Pressable, Text } from '@tloncorp/ui';
import React, { useCallback, useMemo, useState } from 'react';
import { View, XStack, YStack } from 'tamagui';

import { ActionSheet } from '../ActionSheet';
import { TextInput } from '../Form';

type WizardStage = 'purpose' | 'topics' | 'review' | 'submitting';

type WizardState = {
  stage: WizardStage;
  purpose: A2UI.AgentOnboardingPurpose | null;
  selectedTopicIds: string[];
  customTopic: string;
};

const INITIAL_STATE: WizardState = {
  stage: 'purpose',
  purpose: null,
  selectedTopicIds: [],
  customTopic: '',
};

/** Session-only state: remounting a virtualized message must not reset it. */
const wizardStateBySurface = new Map<string, WizardState>();

const ACCENTS: Record<
  A2UI.ChoiceAccent,
  {
    soft: '$blueSoft' | '$greenSoft' | '$indigoSoft' | '$secondaryBackground';
    strong: '$blue' | '$green' | '$indigo' | '$secondaryText';
  }
> = {
  blue: { soft: '$blueSoft', strong: '$blue' },
  green: { soft: '$greenSoft', strong: '$green' },
  indigo: { soft: '$indigoSoft', strong: '$indigo' },
  neutral: { soft: '$secondaryBackground', strong: '$secondaryText' },
};

function resolvedTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function scheduleLabel(timezone: string, hour: number, minute: number): string {
  const time = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: minute ? '2-digit' : undefined,
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(2020, 0, 1, hour, minute)));
  try {
    const zone = new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      timeZoneName: 'long',
    })
      .formatToParts(new Date())
      .find((part) => part.type === 'timeZoneName')?.value;
    return `${time} ${zone ?? timezone}`;
  } catch {
    return `${time} ${timezone}`;
  }
}

function ChoiceCard({
  option,
  onPress,
}: {
  option: A2UI.AgentOnboardingPurpose;
  onPress: () => void;
}) {
  const accent = ACCENTS[option.accent];
  return (
    <Pressable
      testID={`AgentOnboardingPurpose-${option.id}`}
      accessibilityLabel={option.label}
      onPress={onPress}
    >
      <XStack
        borderWidth={1}
        borderColor="$border"
        borderRadius="$xl"
        backgroundColor="$background"
        paddingVertical="$l"
        paddingHorizontal="$l"
        gap="$l"
        alignItems="flex-start"
      >
        <View
          width={32}
          height={32}
          borderRadius="$m"
          backgroundColor={accent.soft}
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
        >
          <Icon
            type={option.icon}
            color={accent.strong}
            customSize={[18, 18]}
          />
        </View>
        <YStack flex={1} minWidth={0} gap="$2xs">
          <Text size="$label/l" fontWeight="500" trimmed={false}>
            {option.label}
          </Text>
          <Text size="$label/m" color="$secondaryText" trimmed={false}>
            {option.description}
          </Text>
        </YStack>
      </XStack>
    </Pressable>
  );
}

function TopicPill({
  label,
  selected,
  showAdd,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  showAdd?: boolean;
  onPress: () => void;
  testID: string;
}) {
  const edge = selected ? '$primaryText' : '$border';
  const fill = selected ? '$primaryText' : '$background';
  const text = selected ? '$background' : '$primaryText';
  return (
    <Pressable
      testID={testID}
      accessibilityLabel={showAdd ? `Add ${label}` : label}
      accessibilityState={{ selected }}
      onPress={onPress}
    >
      <XStack
        borderWidth={1}
        borderColor={edge}
        backgroundColor={fill}
        borderRadius="$2xl"
        paddingVertical="$s"
        paddingHorizontal="$l"
        alignItems="center"
        gap="$xs"
        maxWidth={260}
      >
        {showAdd ? (
          <Icon type="Add" color={text} customSize={[14, 14]} />
        ) : null}
        <Text size="$label/m" color={text} trimmed={false} numberOfLines={1}>
          {label}
        </Text>
      </XStack>
    </Pressable>
  );
}

export function AgentOnboardingSurface({
  component,
  initialPurposeId,
  surfaceId,
  onConfirm,
}: {
  component: A2UI.AgentOnboarding;
  /** Fixture-only entry point; production surfaces always begin at purpose. */
  initialPurposeId?: string;
  surfaceId: string;
  onConfirm?: (plan: A2UI.AgentOnboardingPlan) => void | Promise<void>;
}) {
  const [state, setStateValue] = useState<WizardState>(() => {
    const existing = wizardStateBySurface.get(surfaceId);
    if (existing) return existing;
    const purpose = component.purposes.find(
      (candidate) => candidate.id === initialPurposeId
    );
    return purpose
      ? {
          stage: 'topics',
          purpose,
          selectedTopicIds: [],
          customTopic: '',
        }
      : INITIAL_STATE;
  });
  const [customTopicOpen, setCustomTopicOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState('');

  const setState = useCallback(
    (next: WizardState | ((current: WizardState) => WizardState)) => {
      setStateValue((current) => {
        const value = typeof next === 'function' ? next(current) : next;
        wizardStateBySurface.set(surfaceId, value);
        return value;
      });
    },
    [surfaceId]
  );

  const selectPurpose = useCallback(
    (purpose: A2UI.AgentOnboardingPurpose) => {
      setState({
        stage: 'topics',
        purpose,
        selectedTopicIds: [],
        customTopic: '',
      });
    },
    [setState]
  );

  const topics = useMemo(() => {
    if (!state.purpose) return [];
    const selected = state.purpose.topics
      .filter((topic) => state.selectedTopicIds.includes(topic.id))
      .map((topic) => topic.label);
    return state.customTopic ? [...selected, state.customTopic] : selected;
  }, [state.customTopic, state.purpose, state.selectedTopicIds]);

  const timezone = resolvedTimezone();
  const schedule = state.purpose
    ? scheduleLabel(
        timezone,
        state.purpose.scheduleHour,
        state.purpose.scheduleMinute ?? 0
      )
    : '';

  const submitTopics = useCallback(() => {
    if (!topics.length) return;
    setState((current) => ({ ...current, stage: 'review' }));
  }, [setState, topics]);

  const confirm = useCallback(async () => {
    if (!state.purpose || !topics.length || !onConfirm) return;
    const plan: A2UI.AgentOnboardingPlan = {
      purposeId: state.purpose.id,
      purpose: state.purpose.label,
      topics,
      timezone,
      scheduleHour: state.purpose.scheduleHour,
      scheduleMinute: state.purpose.scheduleMinute ?? 0,
    };
    setState((current) => ({ ...current, stage: 'submitting' }));
    try {
      await onConfirm(plan);
    } catch (error) {
      console.error('Failed to submit agent onboarding plan', error);
      setState((current) => ({ ...current, stage: 'review' }));
    }
  }, [onConfirm, setState, state.purpose, timezone, topics]);

  const saveCustomTopic = useCallback(() => {
    const topic = customDraft.trim();
    if (!topic) return;
    setState((current) => ({ ...current, customTopic: topic }));
    setCustomTopicOpen(false);
  }, [customDraft, setState]);

  return (
    <YStack
      width="100%"
      maxWidth={560}
      gap="$l"
      testID="AgentOnboardingSurface"
    >
      {state.stage === 'purpose' ? (
        <YStack gap="$s">
          <Text size="$body" trimmed={false}>
            What should the group do?
          </Text>
          <YStack gap="$m" width="100%" marginTop="$m">
            {component.purposes.map((purpose) => (
              <ChoiceCard
                key={purpose.id}
                option={purpose}
                onPress={() => void selectPurpose(purpose)}
              />
            ))}
          </YStack>
        </YStack>
      ) : null}

      {state.stage === 'topics' && state.purpose ? (
        <YStack gap="$s">
          <Text size="$body" trimmed={false}>
            Good. What should I keep up with for you? Pick any that fit.
          </Text>
          <YStack gap="$m" width="100%" marginTop="$m">
            <XStack flexWrap="wrap" gap="$s" width="100%">
              {state.purpose.topics.map((topic) => (
                <TopicPill
                  key={topic.id}
                  testID={`AgentOnboardingTopic-${topic.id}`}
                  label={topic.label}
                  selected={state.selectedTopicIds.includes(topic.id)}
                  onPress={() =>
                    setState((current) => ({
                      ...current,
                      selectedTopicIds: current.selectedTopicIds.includes(
                        topic.id
                      )
                        ? current.selectedTopicIds.filter(
                            (id) => id !== topic.id
                          )
                        : [...current.selectedTopicIds, topic.id],
                    }))
                  }
                />
              ))}
              <TopicPill
                testID="AgentOnboardingCustomTopic"
                label={state.customTopic || component.customTopicPlaceholder}
                selected={Boolean(state.customTopic)}
                showAdd
                onPress={() => {
                  setCustomDraft(state.customTopic);
                  setCustomTopicOpen(true);
                }}
              />
            </XStack>
            <Button.Frame
              size="medium"
              fill="solid"
              intent="positive"
              alignSelf="flex-start"
              height={44}
              paddingHorizontal="$xl"
              testID="AgentOnboardingTopicsSubmit"
              disabled={!topics.length}
              dimmed={!topics.length}
              onPress={() => void submitTopics()}
            >
              <Button.Text size="medium">
                {component.topicsSubmitLabel}
              </Button.Text>
            </Button.Frame>
          </YStack>
        </YStack>
      ) : null}

      {(state.stage === 'review' || state.stage === 'submitting') &&
      state.purpose ? (
        <YStack gap="$l">
          <YStack gap="$s">
            <Text size="$label/xl" fontWeight="600" trimmed={false}>
              Here’s the plan
            </Text>
            <Text size="$body" trimmed={false}>
              {state.purpose.label} on {topics.join(', ')} — every day at{' '}
              {schedule}.
            </Text>
          </YStack>
          <XStack gap="$m" flexWrap="wrap">
            {state.stage !== 'submitting' ? (
              <Button
                preset="primary"
                label={component.confirmLabel}
                disabled={!onConfirm}
                onPress={() => void confirm()}
              />
            ) : null}
            <Button
              preset="secondary"
              label="Edit"
              disabled={state.stage === 'submitting'}
              onPress={() =>
                setState((current) => ({ ...current, stage: 'topics' }))
              }
            />
          </XStack>
        </YStack>
      ) : null}

      <ActionSheet
        moveOnKeyboardChange
        modal
        open={customTopicOpen}
        onOpenChange={setCustomTopicOpen}
        unmountOnClose
      >
        <ActionSheet.SimpleHeader title="Add a topic" />
        <ActionSheet.Content>
          <ActionSheet.FormBlock>
            <TextInput
              testID="AgentOnboardingCustomTopicInput"
              autoFocus
              value={customDraft}
              onChangeText={setCustomDraft}
              maxLength={200}
              placeholder={component.customTopicPlaceholder}
              returnKeyType="done"
              onSubmitEditing={saveCustomTopic}
            />
          </ActionSheet.FormBlock>
          <ActionSheet.FormBlock>
            <Button
              preset="primary"
              label="Save"
              centered
              onPress={saveCustomTopic}
            />
          </ActionSheet.FormBlock>
        </ActionSheet.Content>
      </ActionSheet>
    </YStack>
  );
}
