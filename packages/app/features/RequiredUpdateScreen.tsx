import { Button, Text, View } from '@tloncorp/ui';
import { useCallback } from 'react';
import { Linking, Platform } from 'react-native';
import { YStack } from 'tamagui';

import { TLON_APP_STORE_URL, TLON_PLAY_STORE_URL } from '../constants';

export function RequiredUpdateScreen() {
  const storeUrl =
    Platform.OS === 'ios' ? TLON_APP_STORE_URL : TLON_PLAY_STORE_URL;
  const storeName = Platform.OS === 'ios' ? 'App Store' : 'Play Store';

  const handleUpdatePress = useCallback(() => {
    Linking.openURL(storeUrl);
  }, [storeUrl]);

  return (
    <View flex={1} backgroundColor="$background" padding="$2xl">
      <YStack flex={1} justifyContent="center" alignItems="center">
        <YStack
          gap="$m"
          alignItems="center"
          maxWidth={400}
          marginHorizontal="$m"
        >
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
          <Button
            marginTop="$2xl"
            preset="hero"
            label={`View in ${storeName}`}
            onPress={handleUpdatePress}
          />
        </YStack>
      </YStack>
    </View>
  );
}
