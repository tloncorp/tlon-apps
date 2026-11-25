import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useLureMetadata } from '@tloncorp/app/contexts/branch';
import { useShip } from '@tloncorp/app/contexts/ship';
import {
  ActionSheet,
  Button,
  OnboardingButton,
  OnboardingInviteBlock,
  Pressable,
  SizableText,
  TlonText,
  View,
  XStack,
  YStack,
} from '@tloncorp/app/ui';
import { trackOnboardingAction } from '@tloncorp/app/utils/posthog';
import { AnalyticsEvent, trackEvent } from '@tloncorp/shared';
import { finishingSelfHostedLogin as selfHostedLoginStatus } from '@tloncorp/shared/db';
import { useCallback, useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCheckAppInstalled } from '../../hooks/analytics';
import type { OnboardingStackParamList } from '../../types';
import { SatoMark } from './SatoMark';

export const Text = TlonText.Text;

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Welcome'>;
export const WelcomeScreen = ({ navigation }: Props) => {
  const lureMeta = useLureMetadata();
  const { bottom, top } = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);
  const { isAuthenticated } = useShip();
  const finishingSelfHostedLogin = selfHostedLoginStatus.useValue();

  useCheckAppInstalled();

  const handlePressSignup = useCallback(
    (method?: 'email' | 'phone') => {
      trackEvent(AnalyticsEvent.OnboardingPathSelected, {
        path: 'signup',
      });
      setSignupOpen(false);
      navigation.navigate('Signup', method ? { method } : undefined);
    },
    [navigation]
  );

  const handlePressInvite = useCallback(() => {
    trackEvent(AnalyticsEvent.OnboardingPathSelected, {
      path: 'invite',
    });
    setSignupOpen(false);
    navigation.navigate('PasteInviteLink');
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
    <View flex={1} backgroundColor={'$background'} paddingTop={top}>
      <View
        flex={1}
        justifyContent="center"
        alignItems="center"
        gap={28}
        paddingBottom={64}
      >
        <SatoMark />
        <TlonText.Text size="$label/xl">It’s yours.</TlonText.Text>
      </View>
      <View
        paddingBottom={bottom + 6}
        justifyContent={'flex-end'}
        alignItems={'center'}
      >
        <YStack gap={4} paddingHorizontal="$2xl" width={'100%'}>
          <YStack gap="$2xl">
            {lureMeta ? (
              <Pressable
                borderRadius="$2xl"
                pressStyle={{
                  opacity: 0.5,
                }}
                onPress={() => handlePressSignup()}
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
                    onPress={() => handlePressSignup()}
                    label="Join with new account"
                  />
                </YStack>
              </Pressable>
            ) : (
              <OnboardingButton
                onPress={() => setSignupOpen(true)}
                label="Create account"
                testID="welcome-create-account"
              />
            )}
          </YStack>
          <XStack justifyContent="center" height={44} alignItems="center">
            <Pressable
              pressStyle={{
                backgroundColor: '$transparent',
              }}
              onPress={() => setOpen(true)}
            >
              <SizableText color="$primaryText">
                Have an account? Log in
              </SizableText>
            </Pressable>
          </XStack>
        </YStack>
      </View>
      <ActionSheet open={signupOpen} onOpenChange={setSignupOpen} compact>
        <ActionSheet.Content>
          <ActionSheet.ContentBlock gap="$l">
            <OnboardingButton
              onPress={() => handlePressSignup('email')}
              label="Use email"
              testID="signup-with-email"
            />
            <Button
              preset="hero"
              size="medium"
              fill="outline"
              width="100%"
              borderRadius={12}
              borderWidth={1}
              borderColor="$border"
              onPress={() => handlePressSignup('phone')}
              label="Use phone number"
              testID="signup-with-phone"
            />
            <XStack justifyContent="center" paddingTop="$s">
              <Pressable
                onPress={handlePressInvite}
                testID="signup-with-invite"
              >
                <SizableText color="$secondaryText">
                  I have an invite link
                </SizableText>
              </Pressable>
            </XStack>
            <XStack justifyContent="center" flexWrap="wrap">
              <TlonText.Text size="$label/s" color="$tertiaryText">
                By signing up you agree to the{' '}
              </TlonText.Text>
              <Pressable
                onPress={() => {
                  setSignupOpen(false);
                  navigation.navigate('EULA');
                }}
              >
                <TlonText.Text
                  size="$label/s"
                  color="$tertiaryText"
                  textDecorationLine="underline"
                >
                  Terms of Service
                </TlonText.Text>
              </Pressable>
              <TlonText.Text size="$label/s" color="$tertiaryText">
                .
              </TlonText.Text>
            </XStack>
          </ActionSheet.ContentBlock>
        </ActionSheet.Content>
      </ActionSheet>
      <ActionSheet open={open} onOpenChange={setOpen}>
        <ActionSheet.Content>
          <ActionSheet.ActionGroup accent="neutral">
            <ActionSheet.Action
              action={{
                title: 'Log in with phone number',
                action: () => {
                  trackEvent(AnalyticsEvent.OnboardingPathSelected, {
                    path: 'login',
                  });
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
                  trackEvent(AnalyticsEvent.OnboardingPathSelected, {
                    path: 'login',
                  });
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
                trackEvent(AnalyticsEvent.OnboardingPathSelected, {
                  path: 'connect_ship',
                });
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
