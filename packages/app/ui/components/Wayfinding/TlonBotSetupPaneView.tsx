import { TlonText } from '@tloncorp/ui';
import { View, YStack } from 'tamagui';

import { ScreenHeader } from '../ScreenHeader';
import { FadingTextCarousel } from './FadingTextCarousel';
import { SegmentedSpinner } from './SegmentedSpinner';

const noop = () => {};

const SETUP_MESSAGES = [
  'This will take up to 5 minutes. Grab a coffee!',
  "We'll send you a notification when it's ready.",
  'Mention your bot with @ to use it in groups.',
  'You can set up recurring reminders with your bot.',
  'Use your bot to get updates from your group chats.',
  'Your bot can process images and search the web.',
];

export function TlonBotSetupPaneView(props: {
  onLogout?: () => void;
  loggingOut?: boolean;
}) {
  return (
    <View
      flex={1}
      backgroundColor="$secondaryBackground"
      testID="tlonbot-setup-screen"
    >
      <ScreenHeader
        backgroundColor="$secondaryBackground"
        leftControls={
          <ScreenHeader.TextButton
            onPress={props.onLogout ?? noop}
            disabled={props.loggingOut}
            color="$tertiaryText"
          >
            Log out
          </ScreenHeader.TextButton>
        }
      />
      <YStack flex={1} alignItems="center" justifyContent="center" gap="$2xl">
        <SegmentedSpinner />
        <YStack gap="$2xl" paddingHorizontal="$2xl">
          <TlonText.Text
            fontSize="$xl"
            fontWeight="600"
            marginHorizontal="$xl"
            textAlign="center"
          >
            Setting up your Tlonbot...
          </TlonText.Text>
          <FadingTextCarousel messages={SETUP_MESSAGES} />
        </YStack>
      </YStack>
    </View>
  );
}
