import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsDarkMode } from '@tloncorp/app/hooks/useIsDarkMode';
import { requestPhoneVerify } from '@tloncorp/app/lib/hostingApi';
import { trackError, trackOnboardingAction } from '@tloncorp/app/utils/posthog';
import {
  Field,
  ScreenHeader,
  SizableText,
  View,
  YStack,
  useTheme,
} from '@tloncorp/ui';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { CountryPicker } from 'react-native-country-codes-picker';
import PhoneInput from 'react-native-phone-input';

import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<
  OnboardingStackParamList,
  'RequestPhoneVerify'
>;

type FormData = {
  phoneNumber: string;
};

export const RequestPhoneVerifyScreen = ({
  navigation,
  route: {
    params: { user },
  },
}: Props) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remoteError, setRemoteError] = useState<string | undefined>();

  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const phoneInputRef = useRef<PhoneInput>(null);

  const isDarkMode = useIsDarkMode();
  const theme = useTheme();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>();

  const onSubmit = handleSubmit(async ({ phoneNumber }) => {
    setIsSubmitting(true);
    try {
      await requestPhoneVerify(user.id, phoneNumber);
      trackOnboardingAction({
        actionName: 'Phone Verification Requested',
      });
      navigation.navigate('CheckVerify', {
        user: {
          ...user,
          phoneNumber,
        },
      });
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

  return (
    <View flex={1} padding="$l" backgroundColor="$background">
      <ScreenHeader
        title="Confirm"
        showSessionStatus={false}
        backAction={() => navigation.goBack()}
        isLoading={isSubmitting}
        rightControls={
          <ScreenHeader.TextButton onPress={onSubmit} disabled={isSubmitting}>
            Next
          </ScreenHeader.TextButton>
        }
      />
      <YStack gap="$l" padding="$2xl">
        <SizableText color="$primaryText">
          Tlon is a platform for humans. We want to make sure you&rsquo;re one
          too. We&rsquo;ll send you a verification code to the phone number you
          enter below.
        </SizableText>
        {remoteError ? (
          <SizableText color="$negativeActionText" fontSize="$s">
            {remoteError}
          </SizableText>
        ) : null}
        <View display="flex" flexDirection="row" alignItems="center" gap="$m">
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
      </YStack>

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
    </View>
  );
};
