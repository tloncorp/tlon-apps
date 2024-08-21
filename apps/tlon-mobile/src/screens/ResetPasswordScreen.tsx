import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { requestPasswordReset } from '@tloncorp/app/lib/hostingApi';
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

type Props = NativeStackScreenProps<OnboardingStackParamList, 'ResetPassword'>;

type FormData = {
  email: string;
};

export const ResetPasswordScreen = ({
  navigation,
  route: {
    params: { email: emailParam },
  },
}: Props) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remoteError, setRemoteError] = useState<string | undefined>();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      email: emailParam,
    },
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    setIsSubmitting(true);

    try {
      await requestPasswordReset(email);
      navigation.goBack();
    } catch (err) {
      return setRemoteError((err as Error).message);
    }

    setIsSubmitting(false);
  });

  return (
    <View flex={1}>
      <GenericHeader
        title="Reset Password"
        goBack={() => navigation.goBack()}
        showSpinner={isSubmitting}
        rightContent={
          <Button minimal onPress={onSubmit}>
            <Text fontSize={'$m'}>Submit</Text>
          </Button>
        }
      />
      <KeyboardAvoidingView behavior="height" keyboardVerticalOffset={90}>
        <YStack gap="$2xl" padding="$2xl">
          <SizableText size="$l">
            Enter the email associated with your Tlon account.
          </SizableText>
          {remoteError ? (
            <SizableText color="$negativeActionText">{remoteError}</SizableText>
          ) : null}
          <View>
            <SizableText marginBottom="$m">Email</SizableText>
            <Controller
              control={control}
              rules={{
                required: 'Please enter a valid email address.',
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <Input height="$4xl">
                  <Input.Area
                    placeholder="Email Address"
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
                marginTop="$l"
                fontSize={'$s'}
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
