import { ActionSheet } from '@tloncorp/app/ui';
import * as db from '@tloncorp/shared/db';
import { Button, Icon, Text } from '@tloncorp/ui';
import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { View, XStack, YStack } from 'tamagui';

const TLON_WEB_URL = 'https://tlon.network/login';

export function useWebAppSplash() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    db.webAppSplashDismissed.getValue().then((dismissed) => {
      if (!cancelled && !dismissed) {
        setOpen(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = useCallback(() => {
    setOpen(false);
    db.webAppSplashDismissed.setValue(true);
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        dismiss();
      } else {
        setOpen(nextOpen);
      }
    },
    [dismiss]
  );

  const handleOpenWeb = useCallback(() => {
    Linking.openURL(TLON_WEB_URL);
    dismiss();
  }, [dismiss]);

  const splashSheet = (
    <WebAppSplashSheet
      open={open}
      onOpenChange={handleOpenChange}
      onOpenWeb={handleOpenWeb}
    />
  );

  return { splashSheet };
}

function WebAppSplashSheet({
  open,
  onOpenChange,
  onOpenWeb,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenWeb: () => void;
}) {
  return (
    <ActionSheet open={open} onOpenChange={onOpenChange}>
      <ActionSheet.Content>
        <YStack gap="$2xl" paddingHorizontal="$2xl">
          <XStack justifyContent="center" marginTop="$2xl">
            <View
              backgroundColor="$background"
              borderRadius="$xl"
              padding="$xl"
              shadowColor="$shadowColor"
              shadowOffset={{ width: 0, height: 4 }}
              shadowOpacity={0.25}
              shadowRadius={8}
            >
              <Icon type="TBlock" size="$xl" />
            </View>
          </XStack>

          <YStack gap="$2xl" alignItems="center">
            <Text fontSize="$xl" fontWeight="600" textAlign="center">
              Tlon Messenger is on the web
            </Text>
            <Text size="$label/m" color="$tertiaryText" textAlign="center">
              Sign in to your account using a desktop browser.
            </Text>
          </YStack>

          <YStack gap="$l">
            <Button onPress={onOpenWeb} label="Visit tlon.io" centered shadow />
            <Button
              onPress={() => onOpenChange(false)}
              label="Not now"
              preset="secondary"
              backgroundColor="$transparent"
              centered
            />
          </YStack>
        </YStack>
      </ActionSheet.Content>
    </ActionSheet>
  );
}
