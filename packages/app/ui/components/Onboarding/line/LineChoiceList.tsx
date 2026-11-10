import { Pressable, Text } from '@tloncorp/ui';
import { View, XStack, YStack, useTheme } from 'tamagui';

import { LineIcon } from './lineIcons';
import { LineOutline, LineRule } from './lineKit';

export type LineChoice = {
  id: string;
  title: string;
  /** A second, quieter line under the title. */
  meta?: string;
  testID?: string;
};

/**
 * A card of choices with one picked and a radio on the right of each row:
 * the models on You choose the model, the levels on Notifications.
 */
export function LineChoiceList({
  choices,
  selectedId,
  onSelect,
  accessibilityLabel,
  marginTop,
}: {
  choices: LineChoice[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  accessibilityLabel: string;
  marginTop?: number;
}) {
  return (
    <YStack
      marginTop={marginTop}
      marginHorizontal="$2xl"
      borderRadius={14}
      overflow="hidden"
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {choices.map((choice, index) => (
        <LineChoiceRow
          key={choice.id}
          choice={choice}
          selected={choice.id === selectedId}
          first={index === 0}
          onPress={() => onSelect(choice.id)}
        />
      ))}
      <LineOutline radius={14} />
    </YStack>
  );
}

function LineChoiceRow({
  choice,
  selected,
  first,
  onPress,
}: {
  choice: LineChoice;
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
      accessibilityLabel={
        choice.meta ? `${choice.title}, ${choice.meta}` : choice.title
      }
      testID={choice.testID}
    >
      <XStack
        minHeight={choice.meta ? 64 : 56}
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
            {choice.title}
          </Text>
          {choice.meta ? (
            <Text
              fontSize={13}
              lineHeight={18}
              color="$secondaryText"
              numberOfLines={1}
            >
              {choice.meta}
            </Text>
          ) : null}
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
