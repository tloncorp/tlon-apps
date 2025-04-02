import { Icon } from '@tloncorp/ui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SizableText, View, YStack } from 'tamagui';

export function ReadOnlyNotice() {
  return (
    <SafeAreaView edges={['right', 'left', 'bottom']}>
      <YStack
        padding="$l"
        alignItems="center"
        justifyContent="center"
        backgroundColor="$background"
        borderTopWidth={1}
        borderTopColor="$border"
      >
        <View flexDirection="row" alignItems="center" gap="$m">
          <Icon type="Info" size="$s" color="$tertiaryText" />
          <SizableText size="$s" color="$tertiaryText">
            This channel is read-only for you.
          </SizableText>
        </View>
      </YStack>
    </SafeAreaView>
  );
}
