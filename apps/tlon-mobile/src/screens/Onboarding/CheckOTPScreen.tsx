import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSignupParams } from '@tloncorp/app/contexts/branch';
import { trackError, trackOnboardingAction } from '@tloncorp/app/utils/posthog';
import { ScreenHeader, TlonText, View, YStack } from '@tloncorp/ui';
import { createDevLogger } from 'packages/shared/src';
import { useCallback, useMemo, useState } from 'react';

import { OTPInput } from '../../components/OnboardingInputs';
import { useOnboardingContext } from '../../lib/OnboardingContext';
import { useSignupContext } from '../../lib/signupContext';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'CheckOTP'>;

const EMAIL_CODE_LENGTH = 4;
const PHONE_CODE_LENGTH = 6;

const logger = createDevLogger('CheckOTP', true);

export const CheckOTPScreen = ({ navigation, route: { params } }: Props) => {
  const [otp, setOtp] = useState<string[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { hostingApi } = useOnboardingContext();
  const signupContext = useSignupContext();
  const signupParams = useSignupParams();
  const { otpMethod, mode } = params;
  const codeLength =
    otpMethod === 'email' ? EMAIL_CODE_LENGTH : PHONE_CODE_LENGTH;

  const handleSignup = useCallback(
    async (otpCode: string) => {
      try {
        const user = await hostingApi.signUpHostingUser({
          otp: otpCode,
          phoneNumber:
            otpMethod === 'phone' ? signupContext.phoneNumber! : undefined,
          email: otpMethod === 'email' ? signupContext.email! : undefined,
          lure: signupParams.lureId,
          priorityToken: signupParams.priorityToken,
        });
        trackOnboardingAction({
          actionName: 'Account Created',
          phoneNumber:
            otpMethod === 'phone' ? signupContext.phoneNumber! : undefined,
          email: otpMethod === 'email' ? signupContext.email! : undefined,
          lure: signupParams.lureId,
        });
        return user;
      } catch (err) {
        logger.trackError('Error signing up user', {
          thrownErrorMessage: err.message,
        });
        throw err;
      }
    },
    [
      hostingApi,
      otpMethod,
      signupContext.email,
      signupContext.phoneNumber,
      signupParams.lureId,
      signupParams.priorityToken,
    ]
  );

  const handleLogin = useCallback(async (otpCode: string) => {
    // TODO
  }, []);

  const handleSubmit = useCallback(
    async (code: string) => {
      setIsSubmitting(true);
      try {
        if (mode === 'signup') {
          const user = await handleSignup(code);
          signupContext.setOnboardingValues({ hostingUser: user });
          signupContext.kickOffBootSequence();
          navigation.navigate('SetNickname', { user });
        } else {
          await handleLogin(code);
        }
      } catch (e) {
        //
      } finally {
        setIsSubmitting(false);
      }

      try {
        if (otpMethod === 'email') {
          // await hostingApi.verifyEmailDigits(user.email, code);
        } else {
          // await hostingApi.checkPhoneVerify(user.id, code);
        }

        trackOnboardingAction({
          actionName: 'Verification Submitted',
        });

        // signupContext.setOnboardingValues({ hostingUser: user });
        // signupContext.kickOffBootSequence();
        // navigation.navigate('SetNickname', { user });
      } catch (err) {
        console.error('Error submitting verification:', err);
        if (err instanceof Error) {
          setError(err.message);
          trackError(err);
        }
      }

      setIsSubmitting(false);
    },
    [handleLogin, handleSignup, mode, navigation, otpMethod, signupContext]
  );

  const handleCodeChanged = useCallback(
    (nextCode: string[]) => {
      setOtp(nextCode);
      if (nextCode.length === codeLength && nextCode.every(Boolean)) {
        handleSubmit(nextCode.join(''));
      }
    },
    [codeLength, handleSubmit]
  );

  const handleResend = async () => {
    try {
      if (otpMethod === 'email') {
        // await hostingApi.resendEmailVerification(user.id);
      } else {
        // await hostingApi.requestPhoneVerify(user.id, user.phoneNumber ?? '');
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
        title={mode === 'login' ? 'Tlon Login' : 'Confirm Code'}
        backAction={() => navigation.goBack()}
        isLoading={isSubmitting}
      />
      <YStack padding="$2xl" gap="$6xl">
        <OTPInput
          value={otp}
          length={codeLength}
          onChange={handleCodeChanged}
          mode={otpMethod}
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
