import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  checkPhoneVerify,
  requestPhoneVerify,
  resendEmailVerification,
  verifyEmailDigits,
} from '@tloncorp/app/lib/hostingApi';
import { trackError, trackOnboardingAction } from '@tloncorp/app/utils/posthog';
import { formatPhoneNumber } from '@tloncorp/app/utils/string';
import { createRef, useLayoutEffect, useMemo, useState } from 'react';
import type { TextInputKeyPressEventData } from 'react-native';
import { Text, TextInput, View } from 'react-native';
import { useTailwind } from 'tailwind-rn';

import { LoadingSpinner } from '../components/LoadingSpinner';
import type { OnboardingStackParamList } from '../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'CheckVerify'>;

const EMAIL_CODE_LENGTH = 4;
const PHONE_CODE_LENGTH = 6;

export const CheckVerifyScreen = ({
  navigation,
  route: {
    params: { user },
  },
}: Props) => {
  const isEmail = !user.requirePhoneNumberVerification;
  const codeLength = isEmail ? EMAIL_CODE_LENGTH : PHONE_CODE_LENGTH;
  const [code, setCode] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const inputRefs = useMemo(
    () => Array.from({ length: codeLength }).map(() => createRef<TextInput>()),
    []
  );
  const tailwind = useTailwind();

  const handleKeyPress = async (
    index: number,
    key: TextInputKeyPressEventData['key']
  ) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handleChangeText = (index: number, text: string) => {
    const nextCode = [...code];
    if (text.length === 0) {
      nextCode[index] = '';
    } else {
      for (let i = 0; i < text.length; i += 1) {
        nextCode[index + i] = text.charAt(i);
      }
    }

    if (nextCode.length === codeLength && nextCode.every(Boolean)) {
      handleSubmit(nextCode.join(''));
    } else if (index < inputRefs.length - 1 && nextCode[index]) {
      for (let i = index + 1; i < inputRefs.length; i += 1) {
        if (!nextCode[i]) {
          inputRefs[i].current?.focus();
          break;
        }
      }
    }

    setCode(nextCode.slice(0, codeLength));
  };

  const handleSubmit = async (code: string) => {
    setIsSubmitting(true);

    try {
      if (isEmail) {
        await verifyEmailDigits(user.email, code);
      } else {
        await checkPhoneVerify(user.id, code);
      }

      trackOnboardingAction({
        actionName: 'Verification Submitted',
      });

      navigation.navigate('ReserveShip', { user });
    } catch (err) {
      console.error('Error submitting verification:', err);
      if (err instanceof Error) {
        setError(err.message);
        trackError(err);
      }
    }

    setIsSubmitting(false);
  };

  const handleResend = async () => {
    try {
      if (isEmail) {
        await resendEmailVerification(user.id);
      } else {
        await requestPhoneVerify(user.id, user.phoneNumber ?? '');
      }
    } catch (err) {
      console.error('Error resending verification code:', err);
      if (err instanceof Error) {
        setError(err.message);
        trackError(err);
      }
    }
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        isSubmitting ? (
          <View style={tailwind('px-4')}>
            <LoadingSpinner height={16} />
          </View>
        ) : null,
    });
  }, [navigation, isSubmitting]);

  return (
    <View style={tailwind('p-6 h-full bg-white dark:bg-black')}>
      <Text
        style={tailwind(
          'text-lg font-medium text-tlon-black-80 dark:text-white'
        )}
      >
        We've sent a confirmation code to{' '}
        {isEmail ? user.email : formatPhoneNumber(user.phoneNumber ?? '')}
      </Text>
      <View style={tailwind('mt-6 flex flex-row items-center')}>
        {Array.from({ length: codeLength }).map((_, i) => (
          <TextInput
            key={i}
            ref={inputRefs[i]}
            style={tailwind(
              'w-10 mr-2 py-4 font-medium text-center text-tlon-black-80 dark:text-white border-t border border-tlon-black-20 dark:border-tlon-black-80 rounded-lg'
            )}
            onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
            onChangeText={(text) => handleChangeText(i, text)}
            value={code.length > i ? code[i] : ''}
            keyboardType="numeric"
          />
        ))}
      </View>
      {error ? (
        <Text style={tailwind('mt-2 text-tlon-red')}>{error}</Text>
      ) : null}
      <View style={tailwind('mt-6')}>
        <Text style={tailwind('text-lg font-medium text-tlon-black-40')}>
          Didn't receive a code?
        </Text>
        <Text
          style={tailwind('text-lg underline font-medium text-tlon-black-40')}
          onPress={handleResend}
        >
          Send a new code
        </Text>
      </View>
    </View>
  );
};
