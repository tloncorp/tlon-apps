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
  /** A small tag after the title, such as Recommended. */
  badge?: string;
  testID?: string;
};

const RADIO = 22;
const RADIO_DOT = 12;
/** The box's corners, as on the rest of onboarding's larger shapes. */
export const LINE_LIST_RADIUS = 16;
/** Row heights by how many lines of text a row has. */
const ROW_HEIGHT = [56, 72, 92];

/**
 * A box of choices, one picked, with a ring at the start of each row that
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
      borderRadius={LINE_LIST_RADIUS}
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
      <LineOutline radius={LINE_LIST_RADIUS} />
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
        paddingHorizontal={16}
        alignItems="center"
        gap={14}
      >
        {first ? null : <LineRule />}
        <View
          width={RADIO}
          height={RADIO}
          flexShrink={0}
          alignItems="center"
          justifyContent="center"
          alignSelf={choice.meta ? 'flex-start' : 'center'}
          marginTop={choice.meta ? 1 : 0}
        >
          {selected ? (
            <View
              width={RADIO_DOT}
              height={RADIO_DOT}
              borderRadius={RADIO_DOT / 2}
              backgroundColor="$primaryText"
            />
          ) : null}
          <LineOutline
            radius={RADIO / 2}
            color={selected ? '$primaryText' : '$tertiaryText'}
          />
        </View>
        <YStack flex={1}>
          <XStack alignItems="center" gap={8}>
            <Text
              flexShrink={1}
              fontSize={17}
              lineHeight={23}
              letterSpacing={-0.2}
              color="$primaryText"
            >
              {choice.title}
            </Text>
            {choice.badge ? (
              <View paddingHorizontal={6} paddingVertical={1}>
                <Text fontSize={12} lineHeight={16} color="$secondaryText">
                  {choice.badge}
                </Text>
                <LineOutline radius={4} color="$tertiaryText" />
              </View>
            ) : null}
          </XStack>
          {choice.meta ? (
            <Text
              fontSize={15}
              lineHeight={20}
              letterSpacing={-0.1}
              color="$secondaryText"
            >
              {choice.meta}
            </Text>
          ) : null}
          {choice.detail ? (
            <Text
              fontSize={15}
              lineHeight={20}
              letterSpacing={-0.1}
              color="$secondaryText"
            >
              {choice.detail}
            </Text>
          ) : null}
        </YStack>
      </XStack>
    </Pressable>
  );
}
