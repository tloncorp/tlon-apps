import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useLureMetadata } from '@tloncorp/app/contexts/branch';
import { useIsDarkMode } from '@tloncorp/app/hooks/useIsDarkMode';
import {
  ActionSheet,
  AppInviteDisplay,
  Button,
  Icon,
  Image,
  PrimaryButton,
  Sheet,
  SizableText,
  TextV2,
  View,
  XStack,
  YStack,
} from '@tloncorp/ui';
import { useState } from 'react';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { OnboardingStackParamList } from '../../types';
import { OnboardingButton } from './shared';

const Text = TextV2.Text;

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Welcome'>;

export const WelcomeScreen = ({ navigation }: Props) => {
  const lureMeta = useLureMetadata();
  const isDarkMode = useIsDarkMode();
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
        <TextV2.Text size="$label/xl">Tlon Messenger</TextV2.Text>
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
                <AppInviteDisplay metadata={lureMeta} />
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
      <BenefitsSheet />
    </View>
  );
};

function BenefitsSheet() {
  const [open, setOpen] = useState(true);
  return (
    <ActionSheet open={open} onOpenChange={setOpen}>
      <ActionSheet.Content>
        <YStack gap="$3.5xl" paddingHorizontal="$2xl">
          <View borderRadius="$2xl" overflow="hidden">
            <Image
              style={{ width: '100%', height: 188 }}
              resizeMode={'cover'}
              source={require('../../../assets/images/welcome_blocks.jpg')}
            />
          </View>

          <YStack gap="$l">
            <Text fontSize={32} fontWeight={'400'} size="$title/l">
              Welcome to Tlon
            </Text>
            <Text size="$body" color="$tertiaryText">
              A messenger you can actually trust.
            </Text>
          </YStack>

          <XStack gap="$l">
            <View>
              <View
                backgroundColor={'$secondaryBackground'}
                borderRadius={'$3xl'}
                padding="$m"
              >
                <Icon type="Bang" />
              </View>
            </View>
            <YStack gap="$xs" flex={1}>
              <Text fontWeight="$xl">
                Tlon operates on a peer-to-peer network.
              </Text>
              <Text color="$tertiaryText" fontSize={'$xs'} lineHeight={'$xs'}>
                Practically, this means your free account is a cloud computer.
                You can run it yourself, or we can run it for you.
              </Text>
            </YStack>
          </XStack>

          <XStack gap="$l">
            <View>
              <View
                backgroundColor={'$secondaryBackground'}
                borderRadius={'$3xl'}
                padding="$m"
              >
                <Icon type="ChannelTalk" />
              </View>
            </View>
            <YStack gap="$xs" flex={1}>
              <Text fontWeight="$xl">Hassle-free messaging you can trust.</Text>
              <Text color="$tertiaryText" fontSize={'$xs'} lineHeight={'$xs'}>
                We'll make sure your computer is online and up-to-date.
                Interested in self-hosting? You can always change your mind.
              </Text>
            </YStack>
          </XStack>

          <XStack gap="$l">
            <View>
              <View
                backgroundColor={'$secondaryBackground'}
                borderRadius={'$3xl'}
                padding="$m"
              >
                <Icon type="Send" />
              </View>
            </View>
            <YStack gap="$xs" flex={1}>
              <Text fontWeight="$xl">Sign up with your email address.</Text>
              <Text color="$tertiaryText" fontSize={'$xs'} lineHeight={'$xs'}>
                We'll ask you a few questions to get you set up.
              </Text>
            </YStack>
          </XStack>
        </YStack>
      </ActionSheet.Content>
    </ActionSheet>
  );
}
