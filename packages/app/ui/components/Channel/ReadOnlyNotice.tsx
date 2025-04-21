import { Icon } from '@tloncorp/ui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SizableText, View, YStack } from 'tamagui';

export function ReadOnlyNotice({
  type,
}: {
  type: 'read-only' | 'dm-mismatch' | 'channel-mismatch';
}) {
  const Message =
    type === 'read-only' ? (
      <>'This channel is read-only for you.'</>
    ) : (
      <>
        Your node&apos;s version of the Tlon app doesn&apos;t match the{' '}
        {type === 'dm-mismatch' ? 'other node.' : 'channel host.'}
      </>
    );

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
            {Message}
          </SizableText>
        </View>
      </YStack>
    </SafeAreaView>
  );
}
