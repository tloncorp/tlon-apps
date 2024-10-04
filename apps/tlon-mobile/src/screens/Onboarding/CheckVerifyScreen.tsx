import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { trackError, trackOnboardingAction } from '@tloncorp/app/utils/posthog';
import {
  Field,
  ScreenHeader,
  TextInput,
  TextV2,
  View,
  XStack,
  YStack,
} from '@tloncorp/ui';
import { createRef, useMemo, useState } from 'react';
import type { TextInputKeyPressEventData } from 'react-native';
import { TextInput as RNTextInput } from 'react-native';

import { useOnboardingContext } from '../../lib/OnboardingContext';
import type { OnboardingStackParamList } from '../../types';

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
    () =>
      Array.from({ length: codeLength }).map(() => createRef<RNTextInput>()),
    []
  );
  const { hostingApi } = useOnboardingContext();

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
        await hostingApi.verifyEmailDigits(user.email, code);
      } else {
        await hostingApi.checkPhoneVerify(user.id, code);
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
        await hostingApi.resendEmailVerification(user.id);
      } else {
        await hostingApi.requestPhoneVerify(user.id, user.phoneNumber ?? '');
      }
    } catch (err) {
      console.error('Error resending verification code:', err);
      if (err instanceof Error) {
        setError(err.message);
        trackError(err);
      }
    }
  };

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        title="Confirm code"
        backAction={() => navigation.goBack()}
        isLoading={isSubmitting}
      />
      <YStack padding="$2xl" gap="$6xl">
        <Field
          label="Check your email for a confirmation code"
          error={error}
          justifyContent="center"
          alignItems="center"
        >
          <XStack gap="$s">
            {Array.from({ length: codeLength }).map((_, i) => (
              <TextInput
                textAlign="center"
                key={i}
                ref={inputRefs[i]}
                onKeyPress={({ nativeEvent }) =>
                  handleKeyPress(i, nativeEvent.key)
                }
                placeholder="5"
                onChangeText={(text) => handleChangeText(i, text)}
                value={code.length > i ? code[i] : ''}
                keyboardType="numeric"
                maxLength={1}
                paddingHorizontal="$xl"
                paddingVertical="$xl"
                width="$4xl"
              />
            ))}
          </XStack>
        </Field>
        <TextV2.Text
          size="$label/m"
          textAlign="center"
          onPress={handleResend}
          pressStyle={{ opacity: 0.5 }}
        >
          Request a new code
        </TextV2.Text>
      </YStack>
    </View>
  );
};
