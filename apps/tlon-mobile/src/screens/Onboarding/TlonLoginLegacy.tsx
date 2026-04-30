import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { HostingError } from '@tloncorp/api';
import {
  DEFAULT_TLON_LOGIN_EMAIL,
  DEFAULT_TLON_LOGIN_PASSWORD,
  EMAIL_REGEX,
} from '@tloncorp/app/constants';
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
import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared';
import { storage } from '@tloncorp/shared/db';
import { Button, Text } from '@tloncorp/ui';
import { useCallback, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const insets = useSafeAreaInsets();
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
    <KeyboardAvoidingView keyboardVerticalOffset={0}>
      <View
        flex={1}
        backgroundColor="$background"
        paddingTop={insets.top}
        paddingBottom={insets.bottom}
      >
        <YStack flex={1} gap="$2xl" paddingTop="$2xl">
          <View paddingHorizontal="$xl">
            <ScreenHeader.BackButton
              onPress={isSubmitting ? undefined : () => navigation.goBack()}
            />
          </View>
          <SplashTitle>
            Welcome <Text color="$positiveActionText">back.</Text>
          </SplashTitle>
          <SplashParagraph marginBottom={0}>
            Enter the email and password associated with your Tlon account.
          </SplashParagraph>
          <YStack paddingHorizontal="$xl" gap="$2xl">
            {remoteError ? (
              <TlonText.Text size="$label/m" color="$negativeActionText">
                {remoteError}
              </TlonText.Text>
            ) : null}
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
                <Field label="Email" error={errors.email?.message}>
                  <TextInput
                    testID="email-input-legacy"
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
                    testID="password-input-legacy"
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
            <TlonText.Text
              size="$label/m"
              color="$secondaryText"
              textAlign="center"
              onPress={handleForgotPassword}
              textDecorationLine="underline"
              textDecorationDistance={10}
            >
              Forgot password?
            </TlonText.Text>
          </YStack>
        </YStack>
        <YStack paddingHorizontal="$xl" gap="$l" marginTop="$xl">
          <Button
            onPress={onSubmit}
            label={isSubmitting ? 'Logging in…' : 'Log in'}
            preset="hero"
            loading={isSubmitting}
            disabled={!isValid || isSubmitting}
            shadow={isValid && !isSubmitting}
          />
          <TlonText.Text
            size="$label/s"
            color="$tertiaryText"
            textAlign="center"
          >
            By logging in you agree to Tlon&rsquo;s{' '}
            <TlonText.RawText
              pressStyle={{ opacity: 0.5 }}
              textDecorationLine="underline"
              textDecorationDistance={10}
              onPress={handlePressEula}
            >
              Terms of Service
            </TlonText.RawText>
          </TlonText.Text>
        </YStack>
      </View>
    </KeyboardAvoidingView>
  );
};
