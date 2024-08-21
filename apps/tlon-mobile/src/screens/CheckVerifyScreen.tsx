import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  checkPhoneVerify,
  requestPhoneVerify,
  resendEmailVerification,
  verifyEmailDigits,
} from '@tloncorp/app/lib/hostingApi';
import { trackError, trackOnboardingAction } from '@tloncorp/app/utils/posthog';
import { formatPhoneNumber } from '@tloncorp/app/utils/string';
import {
  Button,
  GenericHeader,
  SizableText,
  Text,
  View,
  XStack,
  YStack,
  useTheme,
} from '@tloncorp/ui';
import { createRef, useMemo, useState } from 'react';
import { TextInput } from 'react-native';
import type { TextInputKeyPressEventData } from 'react-native';

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
  const theme = useTheme();
  const isEmail = !user.requirePhoneNumberVerification;
  const codeLength = isEmail ? EMAIL_CODE_LENGTH : PHONE_CODE_LENGTH;
  const [code, setCode] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const inputRefs = useMemo(
    () => Array.from({ length: codeLength }).map(() => createRef<TextInput>()),
    []
  );

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

  return (
    <View flex={1}>
      <GenericHeader
        title="Confirmation"
        goBack={() => navigation.goBack()}
        showSpinner={isSubmitting}
      />
      <YStack padding="$2xl" gap="$xl">
        <SizableText color="$primaryText" fontSize="$l">
          We&rsquo;ve sent a confirmation code to{' '}
          {isEmail ? user.email : formatPhoneNumber(user.phoneNumber ?? '')}.
        </SizableText>
        <XStack gap="$l">
          {Array.from({ length: codeLength }).map((_, i) => (
            <TextInput
              key={i}
              ref={inputRefs[i]}
              style={{
                width: 40,
                height: 40,
                fontSize: 16,
                borderWidth: 1,
                borderColor: theme.border.val,
                borderRadius: 8,
                color: theme.primaryText.val,
                backgroundColor: theme.background.val,
                textAlign: 'center',
              }}
              onKeyPress={({ nativeEvent }) =>
                handleKeyPress(i, nativeEvent.key)
              }
              onChangeText={(text) => handleChangeText(i, text)}
              value={code.length > i ? code[i] : ''}
              keyboardType="numeric"
              maxLength={1}
            />
          ))}
        </XStack>
        {error ? (
          <SizableText color="$red" fontSize="$s">
            {error}
          </SizableText>
        ) : null}
        <YStack gap="$m">
          <SizableText color="$primaryText">
            Didn&rsquo;t receive a code?
          </SizableText>
          <Button secondary onPress={handleResend}>
            <Text>Send a new code</Text>
          </Button>
        </YStack>
      </YStack>
    </View>
  );
};
