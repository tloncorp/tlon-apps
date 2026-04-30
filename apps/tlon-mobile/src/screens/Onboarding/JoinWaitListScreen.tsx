import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { addUserToWaitlist } from '@tloncorp/api';
import { EMAIL_REGEX } from '@tloncorp/app/constants';
import {
  Field,
  KeyboardAvoidingView,
  ScreenHeader,
  SplashParagraph,
  SplashTitle,
  TextInput,
  TlonText,
  View,
  YStack,
} from '@tloncorp/app/ui';
import { trackOnboardingAction } from '@tloncorp/app/utils/posthog';
import { createDevLogger } from '@tloncorp/shared';
import { Button, Text } from '@tloncorp/ui';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'JoinWaitList'>;

type FormData = {
  email: string;
};

const logger = createDevLogger('JoinWaitListScreen', true);

export const JoinWaitListScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const [remoteError, setRemoteError] = useState<string | undefined>();
  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<FormData>();

  const onSubmit = async (data: FormData) => {
    try {
      await addUserToWaitlist({ email: data.email });
      trackOnboardingAction({
        actionName: 'Waitlist Joined',
      });
      Alert.alert('Success', 'You have been added to the waitlist.', [
        {
          text: 'OK',
          onPress: () => navigation.popToTop(),
        },
      ]);
    } catch (err) {
      console.error('Error joining waitlist:', err);
      Alert.alert('Failed', 'Unable to add you to the waitlist.');
      if (err instanceof Error) {
        setRemoteError(err.message);
        logger.trackError('Error joining waitlist', err);
      }
    }
  };

  return (
    <KeyboardAvoidingView keyboardVerticalOffset={0}>
      <View
        flex={1}
        backgroundColor="$background"
        paddingTop={insets.top}
        paddingBottom={insets.bottom}
      >
        <YStack flex={1} gap="$2xl" paddingTop="$2xl">
          <View paddingHorizontal="$xl">
            <ScreenHeader.BackButton onPress={() => navigation.goBack()} />
          </View>
          <SplashTitle>
            Join the <Text color="$positiveActionText">waitlist.</Text>
          </SplashTitle>
          <SplashParagraph marginBottom={0}>
            We&rsquo;ll let you know as soon as space is available.
          </SplashParagraph>
          <YStack paddingHorizontal="$2xl" gap="$m">
            <Controller
              control={control}
              name="email"
              rules={{
                required: 'Please enter a valid email address.',
                pattern: {
                  value: EMAIL_REGEX,
                  message: 'Please enter a valid email address.',
                },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <Field error={errors.email?.message}>
                  <TextInput
                    placeholder="sampel@pal.net"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                    returnKeyType="send"
                    enablesReturnKeyAutomatically
                    onSubmitEditing={handleSubmit(onSubmit)}
                    frameStyle={{
                      height: 72,
                      borderWidth: 0,
                      paddingLeft: 0,
                      paddingRight: 0,
                    }}
                    style={{ fontSize: 24, fontWeight: '600' }}
                  />
                </Field>
              )}
            />
            {remoteError ? (
              <TlonText.Text size="$label/m" color="$negativeActionText">
                {remoteError}
              </TlonText.Text>
            ) : null}
          </YStack>
        </YStack>
        <Button
          onPress={handleSubmit(onSubmit)}
          label="Submit"
          preset="hero"
          disabled={!isValid}
          shadow={isValid}
          marginHorizontal="$2xl"
          marginTop="$xl"
        />
      </View>
    </KeyboardAvoidingView>
  );
};
