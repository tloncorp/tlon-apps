import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { trackError, trackOnboardingAction } from '@tloncorp/app/utils/posthog';
import {
  Field,
  ScreenHeader,
  TextInput,
  TlonText,
  View,
  XStack,
  YStack,
} from '@tloncorp/ui';
import { createRef, useCallback, useMemo, useState } from 'react';
import type { TextInputKeyPressEventData } from 'react-native';
import { TextInput as RNTextInput } from 'react-native';

import { useOnboardingContext } from '../../lib/OnboardingContext';
import type { OnboardingStackParamList } from '../../types';
import { useSignupContext } from '.././../lib/signupContext';

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
  const { hostingApi } = useOnboardingContext();
  const signupContext = useSignupContext();

  const handleSubmit = useCallback(
    async (code: string) => {
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

        signupContext.setOnboardingValues({ hostingUser: user });
        signupContext.kickOffBootSequence();
        navigation.navigate('SetNickname', { user });
      } catch (err) {
        console.error('Error submitting verification:', err);
        if (err instanceof Error) {
          setError(err.message);
          trackError(err);
        }
      }

      setIsSubmitting(false);
    },
    [hostingApi, isEmail, navigation, signupContext, user]
  );

  const handleCodeChanged = useCallback(
    (nextCode: string[]) => {
      setCode(nextCode);
      if (nextCode.length === codeLength && nextCode.every(Boolean)) {
        handleSubmit(nextCode.join(''));
      }
    },
    [codeLength, handleSubmit]
  );

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
        <CodeInput
          value={code}
          length={codeLength}
          onChange={handleCodeChanged}
          isEmail={isEmail}
          error={error}
        />
        <TlonText.Text
          size="$label/m"
          textAlign="center"
          onPress={handleResend}
          pressStyle={{ opacity: 0.5 }}
        >
          Request a new code
        </TlonText.Text>
      </YStack>
    </View>
  );
};

function CodeInput({
  length,
  value,
  isEmail,
  onChange,
  error,
}: {
  length: number;
  isEmail: boolean;
  value: string[];
  onChange?: (value: string[]) => void;
  error?: string;
}) {
  const inputRefs = useMemo(
    () => Array.from({ length }).map(() => createRef<RNTextInput>()),
    [length]
  );

  const handleChangeText = useCallback(
    (index: number, text: string) => {
      const nextCode = [...value];
      if (text.length === 0) {
        nextCode[index] = '';
      } else {
        for (let i = 0; i < text.length; i += 1) {
          nextCode[index + i] = text.charAt(i);
        }
      }
      if (index < inputRefs.length - 1 && nextCode[index]) {
        for (let i = index + 1; i < inputRefs.length; i += 1) {
          if (!nextCode[i]) {
            inputRefs[i].current?.focus();
            break;
          }
        }
      }
      onChange?.(nextCode.slice(0, length));
    },
    [onChange, value, inputRefs, length]
  );

  const handleKeyPress = async (
    index: number,
    key: TextInputKeyPressEventData['key']
  ) => {
    if (key === 'Backspace' && !value[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  return (
    <Field
      label={`Check your ${isEmail ? 'email' : 'phone'} for a confirmation code`}
      error={error}
      justifyContent="center"
      alignItems="center"
    >
      <XStack gap="$s">
        {Array.from({ length }).map((_, i) => (
          <TextInput
            textAlign="center"
            key={i}
            ref={inputRefs[i]}
            onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
            placeholder="5"
            onChangeText={(text) => handleChangeText(i, text)}
            value={value.length > i ? value[i] : ''}
            keyboardType="numeric"
            paddingHorizontal="$xl"
            paddingVertical="$xl"
            width="$4xl"
            textContentType={!isEmail ? 'oneTimeCode' : undefined}
          />
        ))}
      </XStack>
    </Field>
  );
}
