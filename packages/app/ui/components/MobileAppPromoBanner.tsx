import { getConstants } from '@tloncorp/shared/domain';
import { Icon, Image, TlonText } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable } from 'react-native';
import { View, XStack, YStack } from 'tamagui';

import { TLON_APP_STORE_URL, TLON_PLAY_STORE_URL } from '../../constants';
import { useNag } from '../../hooks/useNag';

export function MobileAppPromoBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const isE2eRun = (globalThis as any).TLON_IS_E2E === true;
  const isWeb = Platform.OS === 'web';

  const nag = useNag({
    key: 'mobileAppPromoBanner',
    refreshInterval: 0,
    refreshCycle: 0,
    initialDelay: 500,
  });

  useEffect(() => {
    if (!isE2eRun && nag.shouldShow) {
      const timer = setTimeout(() => setIsVisible(true), 300);
      return () => clearTimeout(timer);
    }
  }, [isE2eRun, nag.shouldShow]);

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

  if (!isWeb || isE2eRun || !nag.shouldShow) {
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
        <YStack gap="$xl">
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
            source={`/apps/groups/mobile-banner.png`}
          />
        </YStack>
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
      </View>
    </View>
  );
}
