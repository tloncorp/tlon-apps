import { Icon, Pressable, Text } from '@tloncorp/ui';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { View, XStack, YStack, useTheme } from 'tamagui';

import { FirstRunFrame } from './FirstRunFrame';
import { FirstRunSheet } from './FirstRunSheet';
import { firstRunCopy } from './firstRunCopy';
import {
  type FirstRunModelRow,
  type FirstRunModelSection,
  findModelRow,
  subscriptionCompany,
} from './firstRunModelOptions';
import type { FirstRunSetupStatus } from './types';

const copy = firstRunCopy.model;

/**
 * Screen 4. The same three ways to get a model as Choose a brain, each saying
 * what it means for retention and cost. The included model is picked to start.
 */
export function ChooseModelScreen({
  status,
  sections,
  selectedId,
  busy,
  onSelect,
  onContinue,
  onBack,
}: {
  status: FirstRunSetupStatus;
  sections: FirstRunModelSection[];
  selectedId: string;
  busy?: boolean;
  onSelect: (id: string) => void;
  onContinue: (row: FirstRunModelRow) => void;
  onBack: () => void;
}) {
  const selected = findModelRow(sections, selectedId);
  return (
    <FirstRunFrame
      step={4}
      onBack={onBack}
      title={copy.title}
      accent={copy.accent}
      body={copy.body}
      status={status}
      primaryLabel={selected?.primaryLabel ?? firstRunCopy.meet.primary}
      onPrimary={() => selected && onContinue(selected)}
      primaryDisabled={!selected}
      primaryLoading={busy}
      testID="first-run-model"
    >
      <YStack
        marginTop="$xl"
        marginHorizontal="$xl"
        gap={14}
        accessibilityRole="radiogroup"
        accessibilityLabel={copy.a11yGroup}
      >
        {sections.map((section) => (
          <YStack key={section.key} gap="$s">
            <Text
              paddingHorizontal="$xs"
              fontSize={13}
              lineHeight={16}
              fontWeight="500"
              color="$secondaryText"
            >
              {section.title}
            </Text>
            <YStack
              borderWidth={1}
              borderColor="$border"
              borderRadius={14}
              overflow="hidden"
            >
              {section.rows.map((row, index) => (
                <ModelOptionRow
                  key={row.id}
                  row={row}
                  selected={row.id === selectedId}
                  showRule={index < section.rows.length - 1}
                  onPress={() => onSelect(row.id)}
                />
              ))}
            </YStack>
          </YStack>
        ))}
      </YStack>
    </FirstRunFrame>
  );
}

function ModelOptionRow({
  row,
  selected,
  showRule,
  onPress,
}: {
  row: FirstRunModelRow;
  selected: boolean;
  showRule: boolean;
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
        minHeight={52}
        paddingVertical="$m"
        paddingHorizontal={14}
        alignItems="center"
        gap="$l"
        backgroundColor={selected ? '$positiveBackground' : '$background'}
        borderBottomWidth={showRule ? 1 : 0}
        borderColor="$border"
      >
        <View
          width={22}
          height={22}
          borderRadius={11}
          borderWidth={selected ? 0 : 1.5}
          borderColor="$tertiaryText"
          backgroundColor={selected ? '$positiveActionText' : '$background'}
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
        >
          {selected ? (
            <Icon type="Checkmark" customSize={[12, 12]} color="$white" />
          ) : null}
        </View>
        <YStack flex={1} gap={1}>
          <XStack alignItems="center" gap="$s" flexWrap="wrap">
            <Text
              fontSize={16}
              lineHeight={22}
              fontWeight={selected ? '500' : '400'}
              color="$primaryText"
            >
              {row.name}
            </Text>
            {row.recommended ? (
              <View
                paddingHorizontal="$s"
                borderRadius={4}
                // The accent at 12%, so the badge still shows on a selected
                // row's pale blue (the canvas's #EAF2FD on white).
                backgroundColor={`${theme.positiveActionText.val}1F`}
              >
                <Text
                  fontSize={12}
                  lineHeight={18}
                  fontWeight="500"
                  color="$positiveActionText"
                >
                  {copy.recommended}
                </Text>
              </View>
            ) : null}
          </XStack>
          <Text fontSize={13} lineHeight={18} color="$secondaryText">
            {row.meta}
          </Text>
        </YStack>
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
  includedName,
  botReady,
  open,
  onOpenChange,
  onContinue,
  onKeepIncluded,
}: {
  row: FirstRunModelRow;
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
