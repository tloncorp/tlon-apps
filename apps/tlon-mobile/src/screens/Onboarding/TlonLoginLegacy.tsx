import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  DEFAULT_TLON_LOGIN_EMAIL,
  DEFAULT_TLON_LOGIN_PASSWORD,
  EMAIL_REGEX,
} from '@tloncorp/app/constants';
import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared';
import { HostingError } from '@tloncorp/shared/api';
import { storage } from '@tloncorp/shared/db';
import {
  Field,
  KeyboardAvoidingView,
  OnboardingTextBlock,
  ScreenHeader,
  TextInput,
  TlonText,
  View,
  YStack,
} from '@tloncorp/app/ui';
import { useCallback, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { useOnboardingHelpers } from '../../hooks/useOnboardingHelpers';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'TlonLogin'>;

type FormData = {
  email: string;
  password: string;
  eulaAgreed: boolean;
};

const logger = createDevLogger('TlonLoginScreen', true);

export const TlonLoginLegacy = ({ navigation }: Props) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remoteError, setRemoteError] = useState<string | undefined>();
  const {
    control,
    setFocus,
    handleSubmit,
    formState: { errors, isValid },
    getValues,
    trigger,
  } = useForm<FormData>({
    defaultValues: {
      email: DEFAULT_TLON_LOGIN_EMAIL,
      password: DEFAULT_TLON_LOGIN_PASSWORD,
      eulaAgreed: false,
    },
    mode: 'onChange',
  });
  const { handleLogin } = useOnboardingHelpers();

  const [passwordVisible, setPasswordVisible] = useState(false);

  const handleForgotPassword = () => {
    const { email } = getValues();
    navigation.navigate('ResetPassword', { email });
  };

  const handlePressEula = useCallback(() => {
    navigation.navigate('EULA');
  }, [navigation]);

  const onSubmit = handleSubmit(async (params) => {
    setIsSubmitting(true);
    await storage.eulaAgreed.setValue(true);

    try {
      await handleLogin(params);
    } catch (err) {
      logger.trackError(AnalyticsEvent.LoginAnomaly, {
        error: err,
        context: 'Failed legacy login',
      });
      if (err instanceof HostingError && err.details.status === 401) {
        setRemoteError('Incorrect email or password.');
      } else {
        logger.trackError(`Error Logging In`, {
          error: err,
          details: err.details,
        });
        setRemoteError(err.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        title="Tlon Login"
        showSessionStatus={false}
        backAction={() => navigation.goBack()}
        isLoading={isSubmitting}
        rightControls={
          <ScreenHeader.TextButton disabled={!isValid} onPress={onSubmit}>
            Submit
          </ScreenHeader.TextButton>
        }
      />
      <KeyboardAvoidingView behavior="height" keyboardVerticalOffset={90}>
        <YStack gap="$m" paddingHorizontal="$2xl">
          <OnboardingTextBlock>
            <TlonText.Text size="$body" color="$primaryText">
              Enter the email and password associated with your Tlon account.
            </TlonText.Text>
            <TlonText.Text size="$body" color="$negativeActionText">
              {remoteError}
            </TlonText.Text>
          </OnboardingTextBlock>

          <YStack gap="$2xl">
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
                <Field
                  label="Email"
                  error={errors.email?.message}
                  paddingTop="$m"
                >
                  <TextInput
                    testID="email-input"
                    placeholder="Email Address"
                    onBlur={() => {
                      onBlur();
                      trigger('email');
                    }}
                    onChangeText={onChange}
                    onSubmitEditing={() => setFocus('password')}
                    value={value}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    enablesReturnKeyAutomatically
                  />
                </Field>
              )}
              name="email"
            />
            <Controller
              control={control}
              rules={{
                required: 'Please enter a password.',
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <Field label="Password" error={errors.password?.message}>
                  <TextInput
                    testID="password-input"
                    placeholder="Password"
                    onBlur={() => {
                      onBlur();
                      trigger('password');
                    }}
                    onChangeText={onChange}
                    onSubmitEditing={onSubmit}
                    value={value}
                    secureTextEntry={!passwordVisible}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="send"
                    enablesReturnKeyAutomatically
                    rightControls={
                      <TextInput.InnerButton
                        label={passwordVisible ? 'Hide' : 'Show'}
                        onPress={() => setPasswordVisible(!passwordVisible)}
                      />
                    }
                  />
                </Field>
              )}
              name="password"
            />
            <View paddingBottom="$m">
              <TlonText.Text
                size="$label/s"
                color="$tertiaryText"
                textAlign="center"
              >
                By logging in you agree to Tlon&rsquo;s{' '}
                <TlonText.RawText
                  pressStyle={{
                    opacity: 0.5,
                  }}
                  textDecorationLine="underline"
                  textDecorationDistance={10}
                  onPress={handlePressEula}
                >
                  Terms of Service
                </TlonText.RawText>
              </TlonText.Text>
            </View>
            <TlonText.Text
              size="$label/m"
              color="$secondaryText"
              textAlign="center"
              onPress={handleForgotPassword}
            >
              Forgot password?
            </TlonText.Text>
          </YStack>
        </YStack>
      </KeyboardAvoidingView>
    </View>
  );
};
