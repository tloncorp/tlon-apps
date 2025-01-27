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
  useStore,
} from '@tloncorp/ui';
import { createRef, useCallback, useMemo, useState } from 'react';
import type { TextInputKeyPressEventData } from 'react-native';
import { TextInput as RNTextInput } from 'react-native';

import { useOnboardingHelpers } from '../../hooks/useOnboardingHelpers';
import type { OnboardingStackParamList } from '../../types';
import { useSignupContext } from '.././../lib/signupContext';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'CheckVerify'>;

const PHONE_CODE_LENGTH = 6;

export const CheckVerifyScreen = ({ navigation, route: { params } }: Props) => {
  const store = useStore();
  const [code, setCode] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const { checkAccountStatusAndNavigate } = useOnboardingHelpers();
  const signupContext = useSignupContext();

  const handleSubmit = useCallback(
    async (code: string) => {
      setIsSubmitting(true);

      try {
        await store.checkPhoneVerify(code);

        trackOnboardingAction({
          actionName: 'Verification Submitted',
        });

        if (params.mode === 'signup') {
          signupContext.kickOffBootSequence();
          navigation.navigate('SetNickname');
        } else {
          checkAccountStatusAndNavigate();
        }
      } catch (err) {
        console.error('Error submitting verification:', err);
        if (err instanceof Error) {
          setError(err.message);
          trackError(err);
        }
      }

      setIsSubmitting(false);
    },
    [
      checkAccountStatusAndNavigate,
      navigation,
      params.mode,
      signupContext,
      store,
    ]
  );

  const handleCodeChanged = useCallback(
    (nextCode: string[]) => {
      setCode(nextCode);
      if (nextCode.length === PHONE_CODE_LENGTH && nextCode.every(Boolean)) {
        handleSubmit(nextCode.join(''));
      }
    },
    [handleSubmit]
  );

  const handleResend = async () => {
    try {
      await store.requestPhoneVerify(params.phoneNumber);
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
          length={PHONE_CODE_LENGTH}
          onChange={handleCodeChanged}
          isEmail={false}
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
            frameStyle={{
              width: '$4xl',
              paddingLeft: 0,
              paddingRight: 0,
            }}
          />
        ))}
      </XStack>
    </Field>
  );
}
