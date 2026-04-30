import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ScreenHeader,
  SplashParagraph,
  SplashTitle,
  TlonText,
  View,
  YStack,
  useStore,
} from '@tloncorp/app/ui';
import { trackOnboardingAction } from '@tloncorp/app/utils/posthog';
import { createDevLogger } from '@tloncorp/shared';
import { Text } from '@tloncorp/ui';
import { useCallback, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OTPInput } from '../../components/OnboardingInputs';
import { useOnboardingHelpers } from '../../hooks/useOnboardingHelpers';
import type { OnboardingStackParamList } from '../../types';
import { useSignupContext } from '.././../lib/signupContext';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'CheckVerify'>;

const PHONE_CODE_LENGTH = 6;

const logger = createDevLogger('CheckVerifyScreen', true);

export const CheckVerifyScreen = ({ navigation, route: { params } }: Props) => {
  const insets = useSafeAreaInsets();
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
          logger.trackError('Error submitting verifications', err);
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
        logger.trackError('Error resending verification code', err);
      }
    }
  };

  return (
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
          Confirm your <Text color="$positiveActionText">code.</Text>
        </SplashTitle>
        <SplashParagraph marginBottom={0}>
          We sent a 6-digit code to your phone.
        </SplashParagraph>
        <YStack paddingHorizontal="$xl" gap="$6xl" paddingTop="$xl">
          <OTPInput
            value={code}
            length={PHONE_CODE_LENGTH}
            onChange={handleCodeChanged}
            mode="phone"
            error={error}
          />
          <TlonText.Text
            size="$label/m"
            textAlign="center"
            color="$secondaryText"
            onPress={handleResend}
            pressStyle={{ opacity: 0.5 }}
            textDecorationLine="underline"
            textDecorationDistance={10}
          >
            Request a new code
          </TlonText.Text>
        </YStack>
      </YStack>
    </View>
  );
};
