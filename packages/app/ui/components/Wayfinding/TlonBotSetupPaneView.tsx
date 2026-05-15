import { TlonText } from '@tloncorp/ui';
import { useVideoPlayer } from 'expo-video/build/VideoPlayer';
import { VideoView } from 'expo-video/build/VideoView';
import { View, YStack, isWeb } from 'tamagui';

import { ScreenHeader } from '../ScreenHeader';
import { FadingTextCarousel } from './FadingTextCarousel';

const arvosVideo = require('../../assets/videos/arvos.mp4');
const ARVOS_SIZE = 160;

const noop = () => {};

const SETUP_MESSAGES = [
  'This will take a bit. Feel free to background the app.',
  "We'll send you a notification when it's ready.",
  'Mention your bot with @ to use it in groups.',
  'You can set up recurring reminders with your bot.',
  'Use your bot to get updates from your group chats.',
  'Your bot can process images and search the web.',
  'You can access Tlon Messenger on the web at tlon.io.',
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
        <ArvosCircle />
        <YStack gap="$2xl" paddingHorizontal="$2xl">
          <TlonText.Text
            fontSize="$xl"
            fontWeight="600"
            marginHorizontal="$xl"
            textAlign="center"
          >
            Setting up your Tlonbot...
          </TlonText.Text>
          <FadingTextCarousel messages={SETUP_MESSAGES} maxWidth={360} />
        </YStack>
      </YStack>
    </View>
  );
}

function ArvosCircle() {
  if (isWeb) {
    return (
      <View
        width={ARVOS_SIZE}
        height={ARVOS_SIZE}
        borderRadius={ARVOS_SIZE / 2}
        overflow="hidden"
      >
        <video
          src={arvosVideo}
          autoPlay
          loop
          muted
          playsInline
          style={{
            width: '106%',
            height: '106%',
            objectFit: 'cover',
          }}
        />
      </View>
    );
  }

  return <ArvosCircleNative />;
}

function ArvosCircleNative() {
  const player = useVideoPlayer(arvosVideo, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <View
      width={ARVOS_SIZE}
      height={ARVOS_SIZE}
      borderRadius={ARVOS_SIZE / 2}
      overflow="hidden"
    >
      <VideoView
        player={player}
        nativeControls={false}
        contentFit="cover"
        style={{ width: '106%', height: '106%' }}
      />
    </View>
  );
}
