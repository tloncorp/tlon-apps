import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useLureMetadata } from '@tloncorp/app/contexts/branch';
import { useShip } from '@tloncorp/app/contexts/ship';
import {
  ActionSheet,
  Image,
  OnboardingButton,
  OnboardingInviteBlock,
  Pressable,
  SizableText,
  SplashTitle,
  TlonText,
  View,
  XStack,
  YStack,
} from '@tloncorp/app/ui';
import { trackOnboardingAction } from '@tloncorp/app/utils/posthog';
import { finishingSelfHostedLogin as selfHostedLoginStatus } from '@tloncorp/shared/db';
import { useEventListener } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCheckAppInstalled } from '../../hooks/analytics';
import type { OnboardingStackParamList } from '../../types';

const WELCOME_BG_VIDEO = {
  uri: 'https://storage.googleapis.com/tlon-messenger-public-assets/welcome-bg.mp4',
};
const WELCOME_BG_POSTER = require('../../../assets/images/welcome-bg-poster.jpg');

export const Text = TlonText.Text;

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Welcome'>;

export const WelcomeScreen = ({ navigation }: Props) => {
  const lureMeta = useLureMetadata();
  const { bottom, top } = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const { isAuthenticated } = useShip();
  const finishingSelfHostedLogin = selfHostedLoginStatus.useValue();

  const videoPlayer = useVideoPlayer(WELCOME_BG_VIDEO, (player) => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  const [videoReady, setVideoReady] = useState(false);
  const videoOpacity = useRef(new Animated.Value(0)).current;

  useEventListener(videoPlayer, 'statusChange', ({ status }) => {
    if (status === 'readyToPlay') {
      setVideoReady(true);
    }
  });

  useEffect(() => {
    if (!videoReady) return;
    Animated.timing(videoOpacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [videoReady, videoOpacity]);

  useCheckAppInstalled();

  const handlePressInvite = useCallback(() => {
    navigation.navigate('Signup');
  }, [navigation]);

  useEffect(() => {
    if (lureMeta) {
      trackOnboardingAction({
        actionName: 'Invite Link Added',
        lure: lureMeta.id,
        inviteType:
          lureMeta.inviteType && lureMeta.inviteType === 'user'
            ? 'user'
            : 'group',
      });
    }
  }, [lureMeta]);

  useEffect(() => {
    if (isAuthenticated && finishingSelfHostedLogin) {
      navigation.navigate('SetTelemetry');
    }
  });

  return (
    <View flex={1} paddingTop={top}>
      {WELCOME_BG_VIDEO ? (
        <>
          <Image
            source={WELCOME_BG_POSTER}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
          <Animated.View
            style={[StyleSheet.absoluteFill, { opacity: videoOpacity }]}
            pointerEvents="none"
          >
            <VideoView
              style={StyleSheet.absoluteFill}
              player={videoPlayer}
              contentFit="cover"
              nativeControls={false}
              allowsFullscreen={false}
              allowsPictureInPicture={false}
            />
          </Animated.View>
        </>
      ) : null}
      <YStack
        flex={1}
        gap="$2xl"
        paddingTop="$2xl"
        alignItems="center"
        justifyContent="center"
      >
        <View
          rotate={'-4deg'}
          shadowColor={'$shadow'}
          shadowOpacity={0.8}
          shadowRadius={'$5xl'}
        >
          <Image
            source={require('../../../assets/images/welcome-icon.png')}
            width={200}
            height={200}
          />
        </View>
        <SplashTitle color={'$white'}>Tlon Messenger</SplashTitle>
      </YStack>
      <View
        paddingBottom={bottom + 16}
        justifyContent={'flex-end'}
        alignItems={'center'}
      >
        <YStack gap="$4xl" paddingHorizontal="$2xl" width={'100%'}>
          <YStack gap="$2xl">
            {lureMeta ? (
              <Pressable
                borderRadius="$2xl"
                pressStyle={{
                  opacity: 0.5,
                }}
                onPress={handlePressInvite}
              >
                <YStack
                  alignItems="stretch"
                  gap="$2xl"
                  padding="$3xl"
                  borderRadius="$2xl"
                  backgroundColor="$shadow"
                  borderColor="$shadow"
                  borderWidth={1}
                >
                  <OnboardingInviteBlock metadata={lureMeta} />
                  <OnboardingButton
                    onPress={handlePressInvite}
                    label="Join with new account"
                  />
                </YStack>
              </Pressable>
            ) : (
              <>
                <OnboardingButton
                  onPress={() => {
                    navigation.navigate('PasteInviteLink');
                  }}
                  label="Sign up"
                />
              </>
            )}
          </YStack>
          <XStack justifyContent="center">
            <Pressable
              pressStyle={{
                backgroundColor: '$transparent',
              }}
              onPress={() => setOpen(true)}
            >
              <SizableText color="$white">Have an account? Log in</SizableText>
            </Pressable>
          </XStack>
        </YStack>
      </View>
      <ActionSheet open={open} onOpenChange={setOpen}>
        <ActionSheet.Content>
          <ActionSheet.ActionGroup accent="neutral">
            <ActionSheet.Action
              action={{
                title: 'Log in with phone number',
                action: () => {
                  setOpen(false);
                  navigation.navigate('TlonLogin', {
                    initialLoginMethod: 'phone',
                  });
                },
              }}
            />
            <ActionSheet.Action
              testID="log-in-with-email"
              action={{
                title: 'Log in with email',
                action: () => {
                  setOpen(false);
                  navigation.navigate('TlonLogin', {
                    initialLoginMethod: 'email',
                  });
                },
              }}
            />
          </ActionSheet.ActionGroup>
          <ActionSheet.ContentBlock alignItems="center">
            <Pressable
              onPress={() => {
                setOpen(false);
                navigation.navigate('ShipLogin');
              }}
            >
              <TlonText.Text
                color="$secondaryText"
                textDecorationLine="underline"
                textDecorationDistance={10}
              >
                Or configure self hosted
              </TlonText.Text>
            </Pressable>
          </ActionSheet.ContentBlock>
        </ActionSheet.Content>
      </ActionSheet>
    </View>
  );
};
