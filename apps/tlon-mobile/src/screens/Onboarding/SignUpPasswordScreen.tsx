import {
  RecaptchaAction,
  execute,
  initClient,
} from '@google-cloud/recaptcha-enterprise-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DEFAULT_LURE, RECAPTCHA_SITE_KEY } from '@tloncorp/app/constants';
import {
  useBranch,
  useLureMetadata,
  useSignupParams,
} from '@tloncorp/app/contexts/branch';
import { useSignupContext } from '@tloncorp/app/contexts/signup';
import {
  logInHostingUser,
  signUpHostingUser,
} from '@tloncorp/app/lib/hostingApi';
import { isEulaAgreed, setEulaAgreed } from '@tloncorp/app/utils/eula';
import { trackError, trackOnboardingAction } from '@tloncorp/app/utils/posthog';
import {
  AppInviteDisplay,
  Button,
  CheckboxInput,
  Field,
  GenericHeader,
  Icon,
  KeyboardAvoidingView,
  ListItem,
  SizableText,
  Text,
  TextInput,
  View,
  YStack,
} from '@tloncorp/ui';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SignUpPassword'>;

type FormData = {
  password: string;
  confirmPassword: string;
  eulaAgreed: boolean;
};

export const SignUpPasswordScreen = ({
  navigation,
  route: {
    params: { email },
  },
}: Props) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const signupContext = useSignupContext();
  const signupParams = useSignupParams();
  const lureMeta = useLureMetadata();
  const {
    control,
    setFocus,
    handleSubmit,
    formState: { errors, isValid },
    setError,
    trigger,
    watch,
  } = useForm<FormData>({
    defaultValues: {
      eulaAgreed: false,
    },
    mode: 'onChange',
  });

  const handleEula = () => {
    navigation.navigate('EULA');
  };

  const onSubmit = handleSubmit(async (params) => {
    const { password } = params;
    setIsSubmitting(true);

    let recaptchaToken: string | undefined;
    try {
      recaptchaToken = await execute(RecaptchaAction.LOGIN(), 10_000);
    } catch (err) {
      console.error('Error executing reCAPTCHA:', err);
      if (err instanceof Error) {
        setError('password', {
          type: 'custom',
          message: err.message,
        });
        trackError(err);
      }
    }

    if (params.eulaAgreed) {
      await setEulaAgreed();
    }

    if (!recaptchaToken) {
      setIsSubmitting(false);
      return;
    }

    if (!isEulaAgreed()) {
      setError('eulaAgreed', {
        type: 'custom',
        message: 'Please agree to the End User License Agreement to continue.',
      });
      setIsSubmitting(false);
      return;
    }

    try {
      await signUpHostingUser({
        email,
        password,
        recaptchaToken,
        lure: signupParams.lureId,
        priorityToken: signupParams.priorityToken,
      });
      signupContext.setDidSignup(true);
    } catch (err) {
      console.error('Error signing up user:', err);
      if (err instanceof Error) {
        setError('password', {
          type: 'custom',
          message: err.message,
        });
        trackError(err);
      }
      setIsSubmitting(false);
      return;
    }

    trackOnboardingAction({
      actionName: 'Account Created',
      email,
      lure: signupParams.lureId,
    });

    try {
      const user = await logInHostingUser({
        email,
        password,
      });
      if (user.requirePhoneNumberVerification) {
        navigation.navigate('RequestPhoneVerify', { user });
      } else {
        navigation.navigate('CheckVerify', { user });
      }
    } catch (err) {
      console.error('Error logging in user:', err);
      if (err instanceof Error) {
        setError('password', {
          type: 'custom',
          message: err.message,
        });
        trackError(err);
      }
    }

    setIsSubmitting(false);
  });

  // Initialize reCAPTCHA client
  useEffect(() => {
    (async () => {
      try {
        await initClient(RECAPTCHA_SITE_KEY, 10_000);
      } catch (err) {
        console.error('Error initializing reCAPTCHA client:', err);
        if (err instanceof Error) {
          setError('password', {
            type: 'custom',
            message: err.message,
          });
          trackError(err);
        }
      }
    })();
  }, []);

  return (
    <View flex={1}>
      <GenericHeader
        title="Set Password"
        showSessionStatus={false}
        goBack={() => navigation.goBack()}
        showSpinner={isSubmitting}
        rightContent={
          isValid &&
          watch('eulaAgreed') && (
            <Button minimal onPress={onSubmit}>
              <Text fontSize="$m">Next</Text>
            </Button>
          )
        }
      />
      <KeyboardAvoidingView behavior="height" keyboardVerticalOffset={90}>
        <YStack gap="$xl" padding="$2xl">
          {lureMeta ? <AppInviteDisplay metadata={lureMeta} /> : null}
          <SizableText color="$primaryText">
            Please set a strong password with at least 8 characters.
          </SizableText>
          <Controller
            control={control}
            name="password"
            rules={{
              required: 'Password must be at least 8 characters.',
              minLength: {
                value: 8,
                message: 'Password must be at least 8 characters.',
              },
            }}
            render={({ field: { onChange, onBlur, value } }) => (
              <Field label="Password" error={errors.password?.message}>
                <TextInput
                  placeholder="Choose a password"
                  onBlur={() => {
                    onBlur();
                    trigger('password');
                  }}
                  onChangeText={onChange}
                  onSubmitEditing={() => setFocus('confirmPassword')}
                  value={value}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  enablesReturnKeyAutomatically
                />
              </Field>
            )}
          />
          <Controller
            control={control}
            name="confirmPassword"
            rules={{
              required: 'Enter the password again for confirmation.',
              validate: (value, { password }) =>
                value === password || 'Passwords must match.',
            }}
            render={({ field: { onChange, onBlur, value } }) => (
              <Field
                label="Confirm Password"
                error={errors.confirmPassword?.message}
              >
                <TextInput
                  placeholder="Confirm password"
                  onBlur={() => {
                    onBlur();
                    trigger('confirmPassword');
                  }}
                  onChangeText={onChange}
                  onSubmitEditing={onSubmit}
                  value={value}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="send"
                  enablesReturnKeyAutomatically
                />
              </Field>
            )}
          />
          <Controller
            control={control}
            name="eulaAgreed"
            render={({ field: { onChange, value } }) => (
              <CheckboxInput
                option={{
                  title:
                    'I have read and agree to the End User License Agreement',
                  value: 'agreed',
                }}
                checked={value}
                onChange={() => onChange(!value)}
              />
            )}
          />
          <ListItem onPress={handleEula}>
            <ListItem.MainContent>
              <ListItem.Title>End User License Agreement</ListItem.Title>
            </ListItem.MainContent>
            <ListItem.EndContent>
              <Icon type="ChevronRight" color="$primaryText" />
            </ListItem.EndContent>
          </ListItem>
        </YStack>
      </KeyboardAvoidingView>
    </View>
  );
};
