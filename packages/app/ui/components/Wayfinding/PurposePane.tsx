import { Button, Pressable, Text } from '@tloncorp/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View, YStack } from 'tamagui';

import { SplashOptionCard } from './SplashOptionCard';
import { SplashParagraph, SplashTitle } from './splashPrimitives';
import { buildStarterOptions } from './starterOptions';

export function PurposePane(props: {
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  onActionPress: () => void;
  onSkipPress: () => void;
}) {
  const { selectedId, onSelect, onActionPress, onSkipPress } = props;
  const insets = useSafeAreaInsets();
  const options = buildStarterOptions();

  return (
    <View flex={1} paddingTop={insets.top} paddingBottom={insets.bottom}>
      <YStack flex={1} gap={'$2xl'} paddingTop="$2xl">
        <SplashTitle>
          What should this <Text color="$positiveActionText">space do?</Text>
        </SplashTitle>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: 12, paddingHorizontal: 24 }}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <SplashParagraph marginHorizontal={0} marginBottom="$s">
            Pick something to start with. You can change it later, or add more.
          </SplashParagraph>
          {options.map((option) => (
            <SplashOptionCard
              key={option.id}
              testID={`starter-option-${option.id}`}
              option={{
                label: option.label,
                description: option.description,
                recommendationLabel: option.recommendationLabel,
              }}
              selected={selectedId === option.id}
              onPress={() => onSelect(option.id)}
            />
          ))}
        </ScrollView>
      </YStack>
      <Button
        data-testid="starter-next"
        testID="starter-next"
        onPress={onActionPress}
        label="Next"
        preset="hero"
        shadow
        marginHorizontal="$xl"
        marginTop="$xl"
        disabled={!selectedId}
      />
      {/* Deliberately a text link rather than a fourth card: this is the
          secondary path, and giving it card parity would read as a fourth
          equally-good starter. */}
      <Pressable testID="starter-something-else" onPress={onSkipPress}>
        <Text
          size="$label/m"
          color="$secondaryText"
          textAlign="center"
          paddingVertical="$l"
        >
          Something else
        </Text>
      </Pressable>
    </View>
  );
}
