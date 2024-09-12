import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsDarkMode } from '@tloncorp/app/hooks/useIsDarkMode';
import {
  ActionSheet,
  AppInviteDisplay,
  PrimaryButton,
  SizableText,
  View,
  YStack,
} from '@tloncorp/ui';
import { useLureMetadata } from 'packages/app/contexts/branch';
import { useState } from 'react';
import { ImageBackground, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Welcome'>;

export const WelcomeScreen = ({ navigation }: Props) => {
  const lureMeta = useLureMetadata();
  const isDarkMode = useIsDarkMode();
  const { bottom } = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const bgSource = isDarkMode
    ? require('../../../assets/images/welcome-bg-dark.png')
    : require('../../../assets/images/welcome-bg.png');

  return (
    <View flex={1}>
      <ImageBackground
        style={{
          flex: 1,
          paddingBottom: bottom + 16,
          justifyContent: 'flex-end',
          alignItems: 'center',
        }}
        source={bgSource}
      >
        {lureMeta ? <AppInviteDisplay metadata={lureMeta} /> : null}
        <YStack gap="$4xl" justifyContent="center" alignItems="center">
          <PrimaryButton
            backgroundColor="$blue"
            hero={true}
            shadow={true}
            onPress={() => {
              navigation.navigate('InventoryCheck');
            }}
          >
            Sign Up with Email
          </PrimaryButton>
          <Pressable onPress={() => setOpen(true)}>
            <SizableText color="$primaryText">
              Have an account? Log in
            </SizableText>
          </Pressable>
        </YStack>
      </ImageBackground>
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
    </View>
  );
};
