import React, { useCallback } from 'react';
import { Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, XStack, YStack } from 'tamagui';

import { Icon } from './Icon';
import { Sheet } from './Sheet';

function WelcomeSheetComponent({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const handleDismiss = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const inset = useSafeAreaInsets();

  return (
    <Sheet
      open={open}
      onOpenChange={handleDismiss}
      snapPointsMode="fit"
      modal
      dismissOnSnapToBottom
      animation="quick"
    >
      <Sheet.Overlay />
      <Sheet.LazyFrame
        paddingTop="$s"
        paddingBottom={inset.bottom}
        paddingHorizontal="$2xl"
      >
        <Sheet.Handle marginBottom="$l" />
        <View paddingHorizontal="$2xl" paddingBottom="$2xl">
          <YStack gap="$2xl">
            <View borderRadius="$xl" overflow="hidden">
              <Image
                style={{ width: '100%', height: 188 }}
                resizeMode={'cover'}
                source={require('../assets/raster/welcome_flowers.jpg')}
              />
            </View>
            <YStack gap="$xs">
              <Text fontSize="$l2">Welcome to TM</Text>
              <Text fontSize="$l" color="$tertiaryText">
                A messenger you can finally trust.
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
                <Text fontWeight="$xl">Control every bit</Text>
                <Text color="$tertiaryText" fontSize={'$xs'} lineHeight={'$xs'}>
                  Whatever you do, say, and make on Tlon is yours to keep
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
                <Text fontWeight="$xl">From now until forever</Text>
                <Text color="$tertiaryText" fontSize={'$xs'} lineHeight={'$xs'}>
                  With Tlon you can always take your data with you and continue
                  using it elsewhere
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
                  <Icon type="Muted" />
                </View>
              </View>
              <YStack gap="$xs" flex={1}>
                <Text fontWeight="$xl">Connect with calm</Text>
                <Text color="$tertiaryText" fontSize={'$xs'} lineHeight={'$xs'}>
                  Tlon is designed to maximize genuine connection, not addictive
                  engagement
                </Text>
              </YStack>
            </XStack>
          </YStack>
        </View>
      </Sheet.LazyFrame>
    </Sheet>
  );
}

export const WelcomeSheet = React.memo(WelcomeSheetComponent);
