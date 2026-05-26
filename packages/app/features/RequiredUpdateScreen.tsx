import { Text, View } from '@tloncorp/ui';
import { YStack } from 'tamagui';

export function RequiredUpdateScreen() {
  return (
    <View flex={1} backgroundColor="$background" padding="$2xl">
      <YStack flex={1} justifyContent="center" alignItems="center">
        <YStack gap="$m" alignItems="center" maxWidth={400}>
          <Text fontSize="$xl" color="$primaryText" textAlign="center">
            Update Required
          </Text>
          <Text
            fontSize="$m"
            color="$secondaryText"
            textAlign="center"
            lineHeight="$m"
          >
            You're running an older version of Tlon that's no longer supported.
            Please update to continue.
          </Text>
        </YStack>
      </YStack>
    </View>
  );
}
