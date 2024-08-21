import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  DEFAULT_LURE,
  DEFAULT_PRIORITY_TOKEN,
  EMAIL_REGEX,
} from '@tloncorp/app/constants';
import { getHostingAvailability } from '@tloncorp/app/lib/hostingApi';
import { trackError, trackOnboardingAction } from '@tloncorp/app/utils/posthog';
import {
  Button,
  GenericHeader,
  Input,
  KeyboardAvoidingView,
  SizableText,
  Text,
  View,
  YStack,
} from '@tloncorp/ui';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import type { OnboardingStackParamList } from '../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SignUpEmail'>;

type FormData = {
  email: string;
};

export const SignUpEmailScreen = ({
  navigation,
  route: {
    params: {
      lure = DEFAULT_LURE,
      priorityToken = DEFAULT_PRIORITY_TOKEN,
    } = {},
  },
}: Props) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<FormData>();

  const onSubmit = handleSubmit(async ({ email }) => {
    setIsSubmitting(true);

    try {
      const { enabled, validEmail } = await getHostingAvailability({
        email,
        lure,
        priorityToken,
      });

      if (!enabled) {
        navigation.navigate('JoinWaitList', { email, lure });
      } else if (!validEmail) {
        setError('email', {
          type: 'custom',
          message:
            'This email address is ineligible for signup. Please contact support@tlon.io',
        });
        trackError({ message: 'Ineligible email address' });
      } else {
        trackOnboardingAction({
          actionName: 'Email submitted',
          email,
          lure,
        });
        navigation.navigate('EULA', { email, lure, priorityToken });
      }
    } catch (err) {
      console.error('Error getting hosting availability:', err);
      if (err instanceof Error) {
        setError('email', {
          type: 'custom',
          message: err.message,
        });
        trackError(err);
      }
    }

    setIsSubmitting(false);
  });

  return (
    <View flex={1}>
      <GenericHeader
        title="Sign Up"
        goBack={() => navigation.goBack()}
        showSpinner={isSubmitting}
        rightContent={
          <Button minimal onPress={onSubmit}>
            <Text fontSize={'$m'}>Next</Text>
          </Button>
        }
      />
      <KeyboardAvoidingView behavior="height" keyboardVerticalOffset={90}>
        <YStack gap="$2xl" padding="$2xl">
          <SizableText color="$primaryText">
            Hosting with Tlon makes running your Urbit easy and reliable. Sign
            up for a free account and your very own Urbit ID.
          </SizableText>
          <View>
            <SizableText marginBottom="$m">Email</SizableText>
            <Controller
              control={control}
              rules={{
                required: 'Please enter a valid email address.',
                pattern: {
                  value: EMAIL_REGEX,
                  message: 'Please enter a valid email address.',
                },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <Input height="$4xl">
                  <Input.Area
                    placeholder="sample@pal.net"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    onSubmitEditing={onSubmit}
                    value={value}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="send"
                    enablesReturnKeyAutomatically
                  />
                </Input>
              )}
              name="email"
            />
            {errors.email && (
              <SizableText
                color="$negativeActionText"
                marginTop="$m"
                fontSize="$s"
              >
                {errors.email.message}
              </SizableText>
            )}
          </View>
        </YStack>
      </KeyboardAvoidingView>
    </View>
  );
};
