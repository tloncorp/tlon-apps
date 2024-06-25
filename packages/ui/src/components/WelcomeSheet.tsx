import { useCallback } from 'react';
import { Image } from 'react-native';

import { Text, View, XStack, YStack } from '../core';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

export function WelcomeSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const handleDismiss = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Sheet
      open={open}
      onOpenChange={handleDismiss}
      snapPoints={[85]}
      modal
      dismissOnSnapToBottom
      animation="quick"
    >
      <Sheet.Overlay />
      <Sheet.LazyFrame paddingTop="$s" paddingHorizontal="$2xl">
        <Sheet.Handle marginBottom="$l" />
        <View paddingHorizontal="$2xl">
          <YStack gap="$2xl">
            <View borderRadius="$xl" overflow="hidden">
              <Image
                style={{ width: '100%', height: 188 }}
                resizeMode={'cover'}
                source={require('../assets/raster/welcome_flowers.jpg')}
              />
            </View>
            <YStack gap="$xs">
              <Text fontSize="$l2">Welcome to Tlon</Text>
              <Text fontSize="$l" color="$tertiaryText">
                A messenger you can actually trust.
              </Text>
            </YStack>
            <XStack gap="$l">
              <View>
                <View
                  backgroundColor={'$secondaryBackground'}
                  borderRadius={'$3xl'}
                  padding="$m"
                >
                  <Icon type="ChannelTalk" />
                </View>
              </View>
              <YStack gap="$xs" flex={1}>
                <Text fontWeight="500">Message privately</Text>
                <Text color="$tertiaryText" fontSize={'$xs'} lineHeight={'$xs'}>
                  When you chat, it&rsquo;s just your computer talking to my
                  computer. No middlemen in between.
                </Text>
              </YStack>
            </XStack>
            <XStack gap="$l">
              <View>
                <View
                  backgroundColor={'$secondaryBackground'}
                  borderRadius={'$3xl'}
                  padding="$m"
                >
                  <Icon type="Bang" />
                </View>
              </View>
              <YStack gap="$xs" flex={1}>
                <Text fontWeight="500">Start a community</Text>
                <Text color="$tertiaryText" fontSize={'$xs'} lineHeight={'$xs'}>
                  Get a group together for a shared purpose; stay because
                  it&rsquo;s free from spying.
                </Text>
              </YStack>
            </XStack>
            <XStack gap="$l">
              <View>
                <View
                  backgroundColor={'$secondaryBackground'}
                  borderRadius={'$3xl'}
                  padding="$m"
                >
                  <Icon type="Clock" />
                </View>
              </View>
              <YStack gap="$xs" flex={1}>
                <Text fontWeight="500">Grow with confidence</Text>
                <Text color="$tertiaryText" fontSize={'$xs'} lineHeight={'$xs'}>
                  Tlon is built for longevity: your community won&rsquo;t
                  disappear and can&rsquo;t be disappeared.
                </Text>
              </YStack>
            </XStack>
          </YStack>
        </View>
      </Sheet.LazyFrame>
    </Sheet>
  );
}
