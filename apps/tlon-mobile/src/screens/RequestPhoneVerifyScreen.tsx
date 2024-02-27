import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useLayoutEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Text, View } from 'react-native';
import { CountryPicker } from 'react-native-country-codes-picker';
import PhoneInput from 'react-native-phone-input';
import { useTailwind } from 'tailwind-rn';

import { HeaderButton } from '../components/HeaderButton';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useIsDarkMode } from '../hooks/useIsDarkMode';
import { requestPhoneVerify } from '../lib/hostingApi';
import type { OnboardingStackParamList } from '../types';
import { trackError, trackOnboardingAction } from '../utils/posthog';

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
  const tailwind = useTailwind();
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
        // Handle HTML response with 500 error from hosting API
        // generates exception when trying to JSON.parse
        // Assumed here to be caused primarily by an already in use phone number
        setRemoteError('Invalid phone number, please contact support@tlon.io');
        trackError({ message: 'Invalid phone number' });
      } else if (err instanceof Error) {
        setRemoteError(err.message);
        trackError(err);
      }
    }

    setIsSubmitting(false);
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        isSubmitting ? (
          <View style={tailwind('px-4')}>
            <LoadingSpinner height={16} />
          </View>
        ) : (
          <HeaderButton title="Next" onPress={onSubmit} />
        ),
    });
  }, [navigation, isSubmitting]);

  return (
    <View style={tailwind('p-6 h-full bg-white dark:bg-black')}>
      <Text
        style={tailwind(
          'text-lg font-medium text-tlon-black-80 dark:text-white'
        )}
      >
        Phone Number
      </Text>
      <Text style={tailwind('text-lg font-medium text-tlon-black-40')}>
        Tlon is a platform for humans. We want to make sure you're one too.
      </Text>
      {remoteError ? (
        <Text style={tailwind('mt-4 text-tlon-red')}>{remoteError}</Text>
      ) : null}
      <View style={tailwind('mt-6 flex flex-row items-center')}>
        <Controller
          control={control}
          rules={{
            required: 'Please enter a valid phone number.',
          }}
          render={({ field: { onChange } }) => (
            <PhoneInput
              ref={phoneInputRef}
              onPressFlag={() => setShowCountryPicker(true)}
              onChangePhoneNumber={onChange}
              style={tailwind(
                'flex-1 px-4 py-3 border border-tlon-black-20 rounded-lg'
              )}
              textStyle={tailwind(
                'font-medium text-tlon-black-80 dark:text-white'
              )}
              initialCountry="us"
              autoFormat={true}
            />
          )}
          name="phoneNumber"
        />
      </View>
      {errors.phoneNumber ? (
        <Text style={tailwind('mt-2 text-tlon-red')}>
          {errors.phoneNumber.message}
        </Text>
      ) : null}

      <CountryPicker
        lang="en"
        show={showCountryPicker}
        // when picker button press you will get the country object with dial code
        pickerButtonOnPress={(item) => {
          phoneInputRef.current?.selectCountry(item.code.toLowerCase());
          setShowCountryPicker(false);
        }}
        style={{
          modal: {
            flex: 0.8,
            backgroundColor: isDarkMode ? '#333' : '#fff',
          },
          countryButtonStyles: {
            backgroundColor: isDarkMode ? '#000' : '#e5e5e5',
          },
          dialCode: {
            color: isDarkMode ? '#fff' : '#000',
          },
          countryName: {
            color: isDarkMode ? '#fff' : '#000',
          },
          textInput: {
            backgroundColor: isDarkMode ? '#000' : '#fff',
            color: isDarkMode ? '#fff' : '#000',
            borderWidth: 1,
            borderColor: '#ccc',
          },
          line: {
            backgroundColor: isDarkMode ? '#000' : '#fff',
          },
        }}
        onBackdropPress={() => setShowCountryPicker(false)}
      />
    </View>
  );
};
