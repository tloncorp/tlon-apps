import * as store from '@tloncorp/shared/store';
import { Icon, Image, TlonText } from '@tloncorp/ui';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable } from 'react-native';
import { View, XStack, YStack } from 'tamagui';

import { TLON_APP_STORE_URL, TLON_PLAY_STORE_URL } from '../../constants';

export function MobileAppPromoBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const isE2eRun = (globalThis as any).TLON_IS_E2E === true;
  const isWeb = Platform.OS === 'web';

  const { data: settings, isLoading } = store.useSettings();

  // Wait for settings to load from the server before deciding. The dismissal
  // is persisted in settings-store (per-account, synced), so once dismissed it
  // stays dismissed across reloads, payloads, and devices. `dismissed` hides it
  // immediately on click, ahead of the settings write round-tripping.
  const shouldShow =
    isWeb &&
    !isE2eRun &&
    !isLoading &&
    !dismissed &&
    settings?.mobileAppPromoDismissed !== true;

  // Default to hidden and only reveal after `shouldShow` has held for the
  // delay. This debounces the initial settings load/sync so a late-arriving
  // "dismissed" value suppresses the banner before it ever paints.
  useEffect(() => {
    if (!shouldShow) {
      setIsVisible(false);
      return;
    }
    const timer = setTimeout(() => setIsVisible(true), 500);
    return () => clearTimeout(timer);
  }, [shouldShow]);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    setDismissed(true);
    store.dismissMobileAppPromo();
  }, []);

  const handleLinkPress = useCallback((url: string) => {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <View
      position="absolute"
      bottom="$xl"
      left="$xl"
      right="$xl"
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
