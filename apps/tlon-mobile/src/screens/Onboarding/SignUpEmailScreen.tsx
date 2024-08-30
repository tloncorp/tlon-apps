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
  Icon,
  KeyboardAvoidingView,
  SizableText,
  Text,
  TextInput,
  View,
  XStack,
  YStack,
} from '@tloncorp/ui';
import { Field } from '@tloncorp/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Controller } from 'react-hook-form';

import type { OnboardingStackParamList } from '../../types';

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
    formState: { errors, isValid },
    setError,
    trigger,
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
            'This email address is ineligible for signup. Please contact support@tlon.io.',
        });
        trackError({ message: 'Ineligible email address' });
      } else {
        trackOnboardingAction({
          actionName: 'Email submitted',
          email,
          lure,
        });
        navigation.navigate('SignUpPassword', { email, lure, priorityToken });
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
        showSessionStatus={false}
        goBack={() => navigation.goBack()}
        showSpinner={isSubmitting}
        rightContent={
          isValid && (
            <Button minimal onPress={onSubmit}>
              <Text fontSize={'$m'}>Next</Text>
            </Button>
          )
        }
      />
      <KeyboardAvoidingView behavior="height" keyboardVerticalOffset={180}>
        <YStack gap="$2xl" padding="$2xl">
          <View>
            <SizableText fontSize="$xl">Pain-free P2P</SizableText>
          </View>

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
              <Field label="Email" error={errors.email?.message}>
                <TextInput
                  placeholder="sampel@pal.net"
                  onBlur={() => {
                    onBlur();
                    trigger('email');
                  }}
                  onChangeText={onChange}
                  onSubmitEditing={onSubmit}
                  value={value}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="send"
                  enablesReturnKeyAutomatically
                />
              </Field>
            )}
          />
        </YStack>
      </KeyboardAvoidingView>
    </View>
  );
};
