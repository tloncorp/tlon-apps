import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsDarkMode } from '@tloncorp/app/hooks/useIsDarkMode';
import {
  Field,
  KeyboardAvoidingView,
  ScreenHeader,
  SplashParagraph,
  SplashTitle,
  TlonText,
  View,
  YStack,
  useStore,
  useTheme,
} from '@tloncorp/app/ui';
import { trackOnboardingAction } from '@tloncorp/app/utils/posthog';
import { createDevLogger } from '@tloncorp/shared';
import { Button, Text } from '@tloncorp/ui';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { CountryPicker } from 'react-native-country-codes-picker';
import PhoneInput from 'react-native-phone-input';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<
  OnboardingStackParamList,
  'RequestPhoneVerify'
>;

type FormData = {
  phoneNumber: string;
};

const logger = createDevLogger('RequestPhoneVerifyScreen', true);

export const RequestPhoneVerifyScreen = ({
  navigation,
  route: { params },
}: Props) => {
  const insets = useSafeAreaInsets();
  const store = useStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remoteError, setRemoteError] = useState<string | undefined>();

  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const phoneInputRef = useRef<PhoneInput>(null);

  useEffect(() => {
    const handle = setTimeout(() => {
      phoneInputRef.current?.focus();
    }, 350);
    return () => clearTimeout(handle);
  }, []);

  const isDarkMode = useIsDarkMode();
  const theme = useTheme();

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<FormData>();

  const onSubmit = handleSubmit(async ({ phoneNumber }) => {
    setIsSubmitting(true);
    try {
      await store.requestPhoneVerify(phoneNumber);
      trackOnboardingAction({
        actionName: 'Phone Verification Requested',
      });
      navigation.navigate('CheckVerify', { phoneNumber, mode: params.mode });
    } catch (err) {
      console.error('Error verifiying phone number:', err);
      if (err instanceof SyntaxError) {
        setRemoteError('Invalid phone number, please contact support@tlon.io');
        logger.trackError('Invalid Phone Number', err);
      } else if (err instanceof Error) {
        setRemoteError(err.message);
        logger.trackError('Error Submitting Phone Verification', err);
      }
    }

    setIsSubmitting(false);
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
            Confirm your <Text color="$positiveActionText">number.</Text>
          </SplashTitle>
          <SplashParagraph marginBottom={0}>
            Tlon is a platform for humans. We&rsquo;ll send a verification code
            to the phone number you enter below.
          </SplashParagraph>
          <YStack paddingHorizontal="$2xl" gap="$m">
            {remoteError ? (
              <TlonText.Text color="$negativeActionText" size="$label/m">
                {remoteError}
              </TlonText.Text>
            ) : null}
            <Controller
              name="phoneNumber"
              control={control}
              rules={{
                required: 'Please enter a valid phone number.',
                validate: (value) => isValidPhoneNumber(value),
              }}
              render={({ field: { onChange } }) => (
                <Field
                  width="100%"
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
                      borderColor: theme.border?.val ?? '#ccc',
                      borderRadius: 8,
                      backgroundColor: theme.background?.val ?? '#fff',
                    }}
                    textStyle={{
                      color: theme.primaryText?.val ?? '#000',
                    }}
                    initialCountry="us"
                    autoFormat={true}
                  />
                </Field>
              )}
            />
          </YStack>
        </YStack>
        <Button
          onPress={onSubmit}
          label={isSubmitting ? 'Sending…' : 'Next'}
          preset="hero"
          loading={isSubmitting}
          disabled={!isValid || isSubmitting}
          shadow={isValid && !isSubmitting}
          marginHorizontal="$2xl"
          marginTop="$xl"
        />
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
              ? theme.background?.val ?? '#000'
              : theme.background?.val ?? '#fff',
          },
          countryButtonStyles: {
            backgroundColor: isDarkMode
              ? theme.background?.val ?? '#000'
              : theme.background?.val ?? '#fff',
          },
          dialCode: {
            color: theme.primaryText?.val ?? '#000',
          },
          countryName: {
            color: theme.primaryText?.val ?? '#000',
          },
          textInput: {
            backgroundColor: isDarkMode
              ? theme.background?.val ?? '#000'
              : theme.background?.val ?? '#fff',
            color: theme.primaryText?.val ?? '#000',
            borderWidth: 1,
            borderColor: theme.border?.val ?? '#ccc',
            padding: 16,
          },
          line: {
            backgroundColor: isDarkMode
              ? theme.background?.val ?? '#000'
              : theme.background?.val ?? '#fff',
          },
        }}
        onBackdropPress={() => setShowCountryPicker(false)}
      />
    </KeyboardAvoidingView>
  );
};
