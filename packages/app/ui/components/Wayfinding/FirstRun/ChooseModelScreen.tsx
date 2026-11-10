import { Pressable, Text } from '@tloncorp/ui';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { View, XStack, YStack, useTheme } from 'tamagui';

import { useOnboardingGlyph } from '../../Onboarding/line/AvatarGlyphPicker';
import {
  ART_TO_CONTENT_GAP,
  LineStepFrame,
} from '../../Onboarding/line/LineStepFrame';
import { LineIcon } from '../../Onboarding/line/lineIcons';
import { LineOutline, LineRule } from '../../Onboarding/line/lineKit';
import { ModelArt } from '../../Onboarding/line/onboardingArt';
import { FirstRunSheet } from './FirstRunSheet';
import { FIRST_RUN_STEPS, firstRunCopy } from './firstRunCopy';
import {
  type FirstRunModelChoiceRow,
  type FirstRunModelRow,
  type FirstRunModelSection,
  buildModelChoiceRows,
  modelChoiceRowId,
  subscriptionCompany,
} from './firstRunModelOptions';

const copy = firstRunCopy.model;

/**
 * You choose the model: the included model, any subscription, or your own
 * key, each saying what it means for retention. The included model is picked
 * to start, and the drawing's line to the pick is solid.
 */
export function ChooseModelScreen({
  sections,
  selectedId,
  busy,
  onSelect,
  onContinue,
  onBack,
}: {
  sections: FirstRunModelSection[];
  /** A model row id; a subscription plan's id selects the subscription row. */
  selectedId: string;
  busy?: boolean;
  onSelect: (id: string) => void;
  onContinue: (choice: FirstRunModelChoiceRow) => void;
  onBack: () => void;
}) {
  const glyph = useOnboardingGlyph();
  const rows = buildModelChoiceRows(sections);
  const pickedId = modelChoiceRowId(selectedId);
  const selected = rows.find((row) => row.id === pickedId);
  return (
    <LineStepFrame
      step={FIRST_RUN_STEPS.model}
      onBack={onBack}
      title={copy.title}
      subtitle={copy.subtitle}
      primary={{
        label: selected?.primaryLabel ?? firstRunCopy.meet.primary,
        onPress: () => selected && onContinue(selected),
        disabled: !selected,
        loading: busy,
        testID: 'first-run-primary',
      }}
      testID="first-run-model"
    >
      <ModelArt glyph={glyph} picked={rows.map((row) => row.id === pickedId)} />
      <YStack
        marginTop={ART_TO_CONTENT_GAP}
        marginHorizontal="$2xl"
        borderRadius={14}
        overflow="hidden"
        accessibilityRole="radiogroup"
        accessibilityLabel={copy.a11yGroup}
      >
        {rows.map((row, index) => (
          <ModelOptionRow
            key={row.id}
            row={row}
            selected={row.id === pickedId}
            first={index === 0}
            onPress={() =>
              onSelect(row.plans ? row.id : (row.row?.id ?? row.id))
            }
          />
        ))}
        <LineOutline radius={14} />
      </YStack>
    </LineStepFrame>
  );
}

function ModelOptionRow({
  row,
  selected,
  first,
  onPress,
}: {
  row: FirstRunModelChoiceRow;
  selected: boolean;
  first: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${row.name}, ${row.meta}`}
      testID={`first-run-model-${row.id}`}
    >
      <XStack
        minHeight={64}
        paddingVertical="$m"
        paddingHorizontal={14}
        alignItems="center"
        gap={12}
        backgroundColor={selected ? '$positiveBackground' : '$background'}
      >
        {first ? null : <LineRule />}
        <YStack flex={1}>
          <Text
            fontSize={16}
            lineHeight={22}
            letterSpacing={-0.2}
            color="$primaryText"
          >
            {row.name}
          </Text>
          <Text
            fontSize={13}
            lineHeight={18}
            color="$secondaryText"
            numberOfLines={1}
          >
            {row.meta}
          </Text>
        </YStack>
        {selected ? (
          <View
            width={22}
            height={22}
            borderRadius={11}
            backgroundColor="$positiveActionText"
            alignItems="center"
            justifyContent="center"
            flexShrink={0}
          >
            <LineIcon
              name="check"
              size={12}
              strokeWidth={2.4}
              color={theme.background?.val as string}
            />
          </View>
        ) : (
          <View width={22} height={22} flexShrink={0}>
            <LineOutline radius={11} />
          </View>
        )}
      </XStack>
    </Pressable>
  );
}

/**
 * Asked before any choice that drops zero data retention: what changes, what
 * it costs, and that the included model stays as the fallback. A subscription
 * signs in through the bot, so its button waits while setup runs.
 */
export function ModelSwitchSheet({
  row,
  plans,
  onPickPlan,
  includedName,
  botReady,
  open,
  onOpenChange,
  onContinue,
  onKeepIncluded,
}: {
  row: FirstRunModelRow;
  /** The plans to pick from, when the subscription row led here. */
  plans?: FirstRunModelRow[];
  onPickPlan?: (plan: FirstRunModelRow) => void;
  includedName: string;
  botReady: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: () => void;
  onKeepIncluded: () => void;
}) {
  const sheet = firstRunCopy.switchSheet;
  const theme = useTheme();
  const iconColor = theme.primaryText.val;
  const isSubscription = row.choice.kind === 'subscription';
  const waiting = isSubscription && !botReady;
  const plan = row.name;
  const company =
    row.choice.kind === 'subscription'
      ? subscriptionCompany(row.choice.provider)
      : '';

  return (
    <FirstRunSheet
      open={open}
      onOpenChange={onOpenChange}
      title={isSubscription ? sheet.subscriptionTitle(plan) : sheet.apiKeyTitle}
      choices={
        plans && plans.length > 1 && onPickPlan ? (
          <PlanChoices plans={plans} picked={row.id} onPick={onPickPlan} />
        ) : undefined
      }
      rows={[
        {
          key: 'zdr',
          icon: <OpenLockIcon color={iconColor} />,
          title: sheet.noZdrTitle,
          detail: isSubscription
            ? sheet.noZdrSubscription(company)
            : sheet.noZdrApiKey,
        },
        {
          key: 'cost',
          icon: <CoinIcon color={iconColor} />,
          title: isSubscription ? sheet.planTitle(plan) : sheet.keyTitle,
          detail: sheet.fallback(includedName),
        },
        {
          key: 'same',
          icon: <BubbleIcon color={iconColor} />,
          title: sheet.sameBotTitle,
          detail: sheet.sameBotDetail,
        },
      ]}
      primaryLabel={
        waiting
          ? sheet.waitingForBot
          : isSubscription
            ? sheet.continueSubscription(plan)
            : sheet.continueApiKey
      }
      primaryLoading={waiting}
      onPrimary={onContinue}
      secondaryLabel={sheet.keep(includedName)}
      onSecondary={onKeepIncluded}
      testID="first-run-switch-sheet"
    />
  );
}

/** The subscription sheet's plan buttons: ChatGPT, Claude, Grok. */
function PlanChoices({
  plans,
  picked,
  onPick,
}: {
  plans: FirstRunModelRow[];
  picked: string;
  onPick: (plan: FirstRunModelRow) => void;
}) {
  return (
    <XStack
      gap="$s"
      accessibilityRole="radiogroup"
      accessibilityLabel={firstRunCopy.switchSheet.planChoice}
    >
      {plans.map((plan) => {
        const selected = plan.id === picked;
        return (
          // Chips sized to their names: the native sheet lays its content
          // out before it knows its width, so they can't share it evenly.
          <View key={plan.id}>
            <Pressable
              onPress={() => onPick(plan)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              testID={`first-run-plan-${plan.id}`}
            >
              <View
                height={40}
                paddingHorizontal={18}
                borderRadius={20}
                alignItems="center"
                justifyContent="center"
                backgroundColor={
                  selected ? '$primaryText' : '$secondaryBackground'
                }
              >
                <Text
                  fontSize={15}
                  lineHeight={20}
                  color={selected ? '$background' : '$primaryText'}
                >
                  {plan.name}
                </Text>
              </View>
            </Pressable>
          </View>
        );
      })}
    </XStack>
  );
}

const iconProps = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function OpenLockIcon({ color }: { color: string }) {
  return (
    <Svg {...iconProps} stroke={color}>
      <Rect x={5} y={11} width={14} height={10} rx={2} />
      <Path d="M8 11V8a4 4 0 0 1 7.5-2" />
    </Svg>
  );
}

function CoinIcon({ color }: { color: string }) {
  return (
    <Svg {...iconProps} stroke={color}>
      <Circle cx={12} cy={12} r={8.5} />
      <Path d="M14.5 9.2c-.6-.8-1.5-1.2-2.6-1.2-1.5 0-2.6.8-2.6 2s1.1 1.6 2.7 2c1.6.4 2.7.9 2.7 2.1s-1.2 2-2.8 2c-1.2 0-2.2-.5-2.8-1.3M12 6.5V8M12 16v1.5" />
    </Svg>
  );
}

function BubbleIcon({ color }: { color: string }) {
  return (
    <Svg {...iconProps} stroke={color}>
      <Path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z" />
    </Svg>
  );
}
