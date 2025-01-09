import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useLureMetadata } from '@tloncorp/app/contexts/branch';
import { useShip } from '@tloncorp/app/contexts/ship';
import { trackOnboardingAction } from '@tloncorp/app/utils/posthog';
import * as db from '@tloncorp/shared/db';
import { finishingSelfHostedLogin as selfHostedLoginStatus } from '@tloncorp/shared/db';
import {
  ActionSheet,
  Button,
  Image,
  OnboardingButton,
  OnboardingInviteBlock,
  Pressable,
  SizableText,
  TlonText,
  View,
  XStack,
  YStack,
} from '@tloncorp/ui';
import { OnboardingBenefitsSheet } from '@tloncorp/ui/src/components/Onboarding/OnboardingBenefitsSheet';
import { useCallback, useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCheckAppInstalled } from '../../hooks/analytics';
import { useSignupContext } from '../../lib/signupContext';
import type { OnboardingStackParamList } from '../../types';

export const Text = TlonText.Text;

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Welcome'>;

export const WelcomeScreen = ({ navigation }: Props) => {
  const lureMeta = useLureMetadata();
  const { bottom, top } = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const didShowBenefitsSheet = db.benefitsSheetDismissed.useValue();
  const signupContext = useSignupContext();
  const { isAuthenticated } = useShip();
  const finishingSelfHostedLogin = selfHostedLoginStatus.useValue();

  useCheckAppInstalled();

  const handleBenefitsSheetOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setTimeout(() => {
        db.benefitsSheetDismissed.setValue(true);
      }, 1000);
    }
    setOpen(open);
  }, []);

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
            ? 'personal'
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
    <View flex={1} backgroundColor={'$secondaryBackground'} paddingTop={top}>
      <View flex={1} justifyContent="center" alignItems="center" gap={'$3.5xl'}>
        <Image
          width={200}
          height={200}
          source={require('../../../assets/images/welcome-icon.png')}
        />
        <TlonText.Text size="$label/xl">Tlon Messenger</TlonText.Text>
      </View>
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
                  <OnboardingButton onPress={handlePressInvite}>
                    <Button.Text>Join with new account</Button.Text>
                  </OnboardingButton>
                </YStack>
              </Pressable>
            ) : (
              <>
                <OnboardingButton
                  onPress={() => {
                    navigation.navigate('PasteInviteLink');
                  }}
                >
                  <Button.Text>Claim invite</Button.Text>
                </OnboardingButton>
                <OnboardingButton
                  secondary
                  onPress={() => {
                    navigation.navigate('JoinWaitList', {});
                  }}
                >
                  <Button.Text>Join waitlist</Button.Text>
                </OnboardingButton>
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
              <SizableText color="$primaryText">
                Have an account? Log in
              </SizableText>
            </Pressable>
          </XStack>
        </YStack>
      </View>
      <ActionSheet
        open={signupContext.reviveCheckComplete && open}
        onOpenChange={setOpen}
      >
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
            <TlonText.Text
              color="$secondaryText"
              textDecorationLine="underline"
              textDecorationDistance={10}
              onPress={() => {
                setOpen(false);
                navigation.navigate('ShipLogin');
              }}
            >
              Or configure self hosted
            </TlonText.Text>
          </ActionSheet.ContentBlock>
        </ActionSheet.Content>
      </ActionSheet>
      {/* 
        Open modals during navigation will cause a crash so we need to be careful not to pop this
        until after checking for onboarding revive (which may auto navigate) 
      */}
      <OnboardingBenefitsSheet
        open={signupContext.reviveCheckComplete && !didShowBenefitsSheet}
        onOpenChange={handleBenefitsSheetOpenChange}
      />
    </View>
  );
};
