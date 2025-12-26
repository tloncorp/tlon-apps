import { Icon, Image, TlonText } from '@tloncorp/ui';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable } from 'react-native';
import { View, XStack, YStack } from 'tamagui';

import { TLON_APP_STORE_URL, TLON_PLAY_STORE_URL } from '../../constants';
import { useNag } from '../../hooks/useNag';

export function MobileAppPromoBanner() {
  const [isVisible, setIsVisible] = useState(false);

  const nag = useNag({
    key: 'mobileAppPromoBanner',
    refreshInterval: 0,
    refreshCycle: 0,
    initialDelay: 500,
  });

  const isWeb = Platform.OS === 'web';

  useEffect(() => {
    if (nag.shouldShow) {
      const timer = setTimeout(() => setIsVisible(true), 300);
      return () => clearTimeout(timer);
    }
  }, [nag.shouldShow]);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => {
      nag.eliminate();
    }, 200);
  }, [nag]);

  const handleLinkPress = useCallback((url: string) => {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, []);

  if (!isWeb || !nag.shouldShow) {
    return null;
  }

  return (
    <View
      position="absolute"
      bottom="$xl"
      left="$xl"
      right="$xl"
      pointerEvents={isVisible ? 'auto' : 'none'}
      zIndex={10}
    >
      <View
        position="relative"
        backgroundColor="$background"
        borderRadius="$l"
        borderWidth={1}
        borderColor="$border"
        padding="$xl"
        paddingBottom={0}
      >
        <Pressable
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            padding: 4,
          }}
          onPress={handleDismiss}
        >
          <Icon type="Close" cursor="pointer" />
        </Pressable>
        <YStack gap="$l">
          <TlonText.Text size="$label/l" color="$primaryText">
            Get Tlon for iOS and Android
          </TlonText.Text>
          <XStack gap="$l">
            <Pressable onPress={() => handleLinkPress(TLON_APP_STORE_URL)}>
              <TlonText.Text size="$label/m" color="$positiveActionText">
                App Store
              </TlonText.Text>
            </Pressable>
            <Pressable onPress={() => handleLinkPress(TLON_PLAY_STORE_URL)}>
              <TlonText.Text size="$label/m" color="$positiveActionText">
                Play Store
              </TlonText.Text>
            </Pressable>
          </XStack>
          <Image
            style={{ width: '100%', height: 150 }}
            contentFit={'cover'}
            source={`./mobile-banner.png`}
          />
        </YStack>
      </View>
    </View>
  );
}
