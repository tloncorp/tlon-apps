import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useLureMetadata } from '@tloncorp/app/contexts/branch';
import { useIsDarkMode } from '@tloncorp/app/hooks/useIsDarkMode';
import {
  ActionSheet,
  Button,
  Image,
  OnboardingInviteBlock,
  SizableText,
  TlonText,
  View,
  XStack,
  YStack,
} from '@tloncorp/ui';
import { OnboardingButton } from '@tloncorp/ui';
import { OnboardingBenefitsSheet } from '@tloncorp/ui/src/components/Onboarding/OnboardingBenefitsSheet';
import { useState } from 'react';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { OnboardingStackParamList } from '../../types';

export const Text = TlonText.Text;

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Welcome'>;

export const WelcomeScreen = ({ navigation }: Props) => {
  const lureMeta = useLureMetadata();
  const { bottom, top } = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

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
                  onPress={() => {
                    navigation.navigate('SignUpEmail');
                  }}
                >
                  <Button.Text>Join with new account</Button.Text>
                </OnboardingButton>
              </YStack>
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
            <Pressable onPress={() => setOpen(true)}>
              <SizableText color="$primaryText">
                Have an account? Log in
              </SizableText>
            </Pressable>
          </XStack>
        </YStack>
      </View>
      <ActionSheet open={open} onOpenChange={setOpen}>
        <ActionSheet.Content>
          <ActionSheet.ActionGroup accent="neutral">
            <ActionSheet.Action
              action={{
                title: 'Log in with Email',
                action: () => {
                  setOpen(false);
                  navigation.navigate('TlonLogin');
                },
              }}
            />
            <ActionSheet.Action
              action={{
                title: 'Configure self-hosted',
                action: () => {
                  setOpen(false);
                  navigation.navigate('ShipLogin');
                },
              }}
            />
          </ActionSheet.ActionGroup>
        </ActionSheet.Content>
      </ActionSheet>
      <OnboardingBenefitsSheet />
    </View>
  );
};
