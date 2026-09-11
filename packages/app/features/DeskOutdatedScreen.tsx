import { Button, TlonText } from '@tloncorp/ui';
import { useCallback } from 'react';
import { Linking } from 'react-native';
import { View, YStack } from 'tamagui';

import { DESK_UPDATE_HELP_URL } from '../constants';
// Imported directly rather than through the `../ui` barrel: this screen is
// mounted by the app shell before anything else, so it shouldn't drag the whole
// component library in behind it.
import { EmailSupportLink } from '../ui/components/EmailSupportLink';
import { ScreenHeader } from '../ui/components/ScreenHeader';

export type DeskOutdatedScreenProps = {
  /** Version the ship reports, or null when we couldn't read one. */
  currentVersion: string | null;
  minimumVersion: string;
  /** How to name the ship in the copy; defaults to a generic phrase. */
  shipName?: string;
  /** A re-probe is in flight, so the retry action is unavailable. */
  isProbing?: boolean;
  onRetry: () => void;
  /** Omitted where there's no logout to offer, e.g. web. */
  onLogout?: () => void | Promise<void>;
};

export function DeskOutdatedScreen({
  currentVersion,
  minimumVersion,
  shipName,
  isProbing = false,
  onRetry,
  onLogout,
}: DeskOutdatedScreenProps) {
  const handleHelpPress = useCallback(() => {
    Linking.openURL(DESK_UPDATE_HELP_URL);
  }, []);

  return (
    <View flex={1} backgroundColor="$background" testID="desk-outdated-screen">
      <ScreenHeader
        title="Update your ship"
        backgroundColor="$background"
        leftControls={
          onLogout ? (
            <ScreenHeader.TextButton color="$secondaryText" onPress={onLogout}>
              Log out
            </ScreenHeader.TextButton>
          ) : undefined
        }
      />
      <YStack flex={1} paddingHorizontal="$2xl" paddingBottom="$2xl">
        <YStack gap="$m" marginTop="$3.5xl">
          <TlonText.Text size="$title/l" color="$primaryText" trimmed={false}>
            Your ship needs an update
          </TlonText.Text>
          <TlonText.Text
            size="$label/xl"
            color="$secondaryText"
            trimmed={false}
            maxWidth={340}
          >
            {'Tlon needs the Groups desk '}
            <TlonText.RawText
              testID="desk-outdated-minimum"
              color="$primaryText"
              fontWeight="500"
            >
              {minimumVersion}
            </TlonText.RawText>
            {' or newer. '}
            {shipName ?? 'Your ship'}
            {' reports '}
            <TlonText.RawText
              testID="desk-outdated-current"
              color="$primaryText"
              fontWeight="500"
            >
              {currentVersion ?? 'an older version'}
            </TlonText.RawText>
            .
          </TlonText.Text>
        </YStack>

        <YStack marginTop="auto" gap="$xl">
          <Button
            preset="hero"
            label="Try again"
            loading={isProbing}
            disabled={isProbing}
            onPress={onRetry}
            testID="desk-outdated-retry"
          />
          <Button
            preset="minimal"
            size="medium"
            label="How to update"
            onPress={handleHelpPress}
            centered
            testID="desk-outdated-help"
          />
          <EmailSupportLink
            size="$label/l"
            prompt="Still stuck? Email"
            subject="Help! My ship needs an update."
          />
        </YStack>
      </YStack>
    </View>
  );
}
