import { Pressable, Text } from '@tloncorp/ui';
import { View, XStack, YStack } from 'tamagui';

import { LineOutline, LineRule } from './lineKit';

export type LineChoice = {
  id: string;
  title: string;
  /** A second, quieter line under the title. */
  meta?: string;
  /** A third line, under the meta. */
  detail?: string;
  testID?: string;
};

const RADIO = 20;
const RADIO_DOT = 10;
/** Row heights by how many lines of text a row has. */
const ROW_HEIGHT = [56, 68, 88];

/**
 * A box of choices, one picked, with a ring on the right of each row that
 * fills with a dot when it's the pick: the models on You choose the model,
 * the levels on Notifications.
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
      <LineOutline radius={0} />
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
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={[choice.title, choice.meta, choice.detail]
        .filter(Boolean)
        .join(', ')}
      testID={choice.testID}
    >
      <XStack
        minHeight={ROW_HEIGHT[(choice.meta ? 1 : 0) + (choice.detail ? 1 : 0)]}
        paddingVertical="$m"
        paddingHorizontal={14}
        alignItems="center"
        gap={12}
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
              fontSize={14}
              lineHeight={20}
              letterSpacing={-0.1}
              color="$secondaryText"
              numberOfLines={1}
            >
              {choice.meta}
            </Text>
          ) : null}
          {choice.detail ? (
            <Text
              fontSize={14}
              lineHeight={20}
              letterSpacing={-0.1}
              color="$secondaryText"
              numberOfLines={1}
            >
              {choice.detail}
            </Text>
          ) : null}
        </YStack>
        <View
          width={RADIO}
          height={RADIO}
          flexShrink={0}
          alignItems="center"
          justifyContent="center"
        >
          {selected ? (
            <View
              width={RADIO_DOT}
              height={RADIO_DOT}
              borderRadius={RADIO_DOT / 2}
              backgroundColor="$primaryText"
            />
          ) : null}
          <LineOutline radius={RADIO / 2} />
        </View>
      </XStack>
    </Pressable>
  );
}
