import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DEFAULT_ONBOARDING_TLON_EMAIL } from '@tloncorp/app/constants';
import {
  useLureMetadata,
  useSignupParams,
} from '@tloncorp/app/contexts/branch';
import { useIsDarkMode } from '@tloncorp/app/hooks/useIsDarkMode';
import { trackError, trackOnboardingAction } from '@tloncorp/app/utils/posthog';
import {
  Field,
  KeyboardAvoidingView,
  OnboardingInviteBlock,
  ScreenHeader,
  TlonText,
  View,
  YStack,
  useTheme,
} from '@tloncorp/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { CountryPicker } from 'react-native-country-codes-picker';
import PhoneInput from 'react-native-phone-input';

import { useRecaptcha } from '../../hooks/useRecaptcha';
import { useOnboardingContext } from '../../lib/OnboardingContext';
import type { OnboardingStackParamList } from '../../types';
import { useSignupContext } from '.././../lib/signupContext';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SignUpEmail'>;

type FormData = {
  phoneNumber: string;
};

function genDefaultEmail() {
  const entropy = String(Math.random()).slice(2, 12);
  return `${DEFAULT_ONBOARDING_TLON_EMAIL}+test${entropy}@tlon.io`;
}

export const SignUpPhoneNumberScreen = ({
  navigation,
  route: { params },
}: Props) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remoteError, setRemoteError] = useState<string | undefined>();
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const { hostingApi } = useOnboardingContext();

  const signupParams = useSignupParams();
  const signupContext = useSignupContext();
  const lureMeta = useLureMetadata();
  const phoneInputRef = useRef<PhoneInput>(null);
  const isDarkMode = useIsDarkMode();
  const theme = useTheme();
  const recaptcha = useRecaptcha();

  useEffect(() => {
    // wait for transition to complete, then focus
    setTimeout(() => {
      phoneInputRef.current?.focus();
    }, 500);
  }, []);

  const handlePressEmailSignup = useCallback(() => {
    navigation.navigate('SignUpEmail');
  }, [navigation]);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>();

  const onSubmit = handleSubmit(async ({ phoneNumber }) => {
    setIsSubmitting(true);
    try {
      const recaptchaToken = await recaptcha.getToken();
      if (!recaptchaToken) {
        setRemoteError(
          `We're having trouble confirming you're human. (reCAPTCHA)`
        );
        return;
      }

      await hostingApi.requestPhoneSignupOtp({ phoneNumber, recaptchaToken });
      trackOnboardingAction({
        actionName: 'Phone Number Submitted',
      });

      // navigation.navigate('CheckVerify', {
      //   user: {
      //     ...user,
      //     phoneNumber,
      //   },
      // });
    } catch (err) {
      console.error('Error verifiying phone number:', err);
      if (err instanceof SyntaxError) {
        setRemoteError('Invalid phone number, please contact support@tlon.io');
        trackError({ message: 'Invalid phone number' });
      } else if (err instanceof Error) {
        setRemoteError(err.message);
        trackError(err);
      }
    }

    setIsSubmitting(false);
  });

  const goBack = useCallback(() => {
    signupContext.clear();
    navigation.goBack();
  }, [navigation, signupContext]);

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        title="Accept invite"
        showSessionStatus={false}
        backAction={goBack}
        isLoading={isSubmitting}
      />
      <KeyboardAvoidingView behavior="height" keyboardVerticalOffset={180}>
        <YStack gap="$2xl" paddingHorizontal="$2xl" paddingVertical="$l">
          {lureMeta ? <OnboardingInviteBlock metadata={lureMeta} /> : null}
          <View
            display="flex"
            flexDirection="row"
            alignItems="center"
            gap="$m"
            paddingTop="$m"
          >
            <Controller
              name="phoneNumber"
              control={control}
              rules={{
                required: 'Please enter a valid phone number.',
              }}
              render={({ field: { onChange } }) => (
                <Field
                  width={'100%'}
                  label="Phone Number"
                  error={errors.phoneNumber?.message}
                >
                  <PhoneInput
                    ref={phoneInputRef}
                    onPressFlag={() => setShowCountryPicker(true)}
                    onChangePhoneNumber={onChange}
                    style={{
                      padding: 16,
                      borderWidth: 1,
                      borderColor: theme.border.val,
                      borderRadius: 8,
                      backgroundColor: theme.background.val,
                    }}
                    textStyle={{
                      color: theme.primaryText.val,
                    }}
                    initialCountry="us"
                    autoFormat={true}
                  />
                </Field>
              )}
            />
          </View>
          <View marginLeft="$l">
            <TlonText.Text size="$label/s" color="$tertiaryText">
              Or if you&apos;d prefer,{' '}
              <TlonText.RawText
                pressStyle={{
                  opacity: 0.5,
                }}
                textDecorationLine="underline"
                textDecorationDistance={10}
                onPress={handlePressEmailSignup}
              >
                sign up with email
              </TlonText.RawText>
            </TlonText.Text>
          </View>
          <CountryPicker
            lang="en"
            show={showCountryPicker}
            pickerButtonOnPress={(item) => {
              phoneInputRef.current?.selectCountry(item.code.toLowerCase());
              setShowCountryPicker(false);
            }}
            style={{
              modal: {
                flex: 0.8,
                backgroundColor: isDarkMode
                  ? theme.background.val
                  : theme.background.val,
              },
              countryButtonStyles: {
                backgroundColor: isDarkMode
                  ? theme.background.val
                  : theme.background.val,
              },
              dialCode: {
                color: theme.primaryText.val,
              },
              countryName: {
                color: theme.primaryText.val,
              },
              textInput: {
                backgroundColor: isDarkMode
                  ? theme.background.val
                  : theme.background.val,
                color: theme.primaryText.val,
                borderWidth: 1,
                borderColor: theme.border.val,
                padding: 16,
              },
              line: {
                backgroundColor: isDarkMode
                  ? theme.background.val
                  : theme.background.val,
              },
            }}
            onBackdropPress={() => setShowCountryPicker(false)}
          />
        </YStack>
      </KeyboardAvoidingView>
    </View>
  );
};
