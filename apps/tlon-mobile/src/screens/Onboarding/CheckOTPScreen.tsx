import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSignupParams } from '@tloncorp/app/contexts/branch';
import { useShip } from '@tloncorp/app/contexts/ship';
import { isEulaAgreed, setEulaAgreed } from '@tloncorp/app/utils/eula';
import { trackError, trackOnboardingAction } from '@tloncorp/app/utils/posthog';
import { getShipUrl } from '@tloncorp/app/utils/ship';
import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared';
import { getLandscapeAuthCookie } from '@tloncorp/shared/api';
import { didSignUp } from '@tloncorp/shared/db';
import { ScreenHeader, TlonText, View, YStack } from '@tloncorp/ui';
import { useCallback, useState } from 'react';

import { OTPInput } from '../../components/OnboardingInputs';
import { useRecaptcha } from '../../hooks/useRecaptcha';
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
  const { setShip } = useShip();
  const { otpMethod, mode } = params;
  const recaptcha = useRecaptcha();
  const codeLength =
    otpMethod === 'email' ? EMAIL_CODE_LENGTH : PHONE_CODE_LENGTH;

  const handleSignup = useCallback(
    async (otpCode: string) => {
      try {
        const recaptchaToken = await recaptcha.getToken();
        if (!recaptchaToken) {
          setError(`We're having trouble confirming you're human. (reCAPTCHA)`);
          throw new Error('reCAPTCHA token not available');
        }

        const user = await hostingApi.signUpHostingUser({
          otp: otpCode,
          phoneNumber:
            otpMethod === 'phone'
              ? params.phoneNumber ?? signupContext.phoneNumber!
              : undefined,
          email:
            otpMethod === 'email'
              ? params.email ?? signupContext.email!
              : undefined,
          lure: signupParams.lureId,
          priorityToken: signupParams.priorityToken,
          recaptchaToken,
        });
        trackOnboardingAction({
          actionName: 'Account Created',
          phoneNumber:
            otpMethod === 'phone'
              ? params.phoneNumber ?? signupContext.phoneNumber!
              : undefined,
          email:
            otpMethod === 'email'
              ? params.email ?? signupContext.email!
              : undefined,
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
      params.email,
      params.phoneNumber,
      recaptcha,
      signupContext.email,
      signupContext.phoneNumber,
      signupParams.lureId,
      signupParams.priorityToken,
    ]
  );

  const handleLogin = useCallback(
    async (otpCode: string) => {
      const user = await hostingApi.logInHostingUser({
        otp: otpCode,
        phoneNumber:
          otpMethod === 'phone'
            ? params.phoneNumber ?? signupContext.phoneNumber!
            : undefined,
        email:
          otpMethod === 'email'
            ? params.email ?? signupContext.email!
            : undefined,
      });

      if (user.ships.length > 0) {
        const shipsWithStatus = await hostingApi.getShipsWithStatus(user.ships);
        if (shipsWithStatus) {
          const { status, shipId } = shipsWithStatus;
          if (status === 'Ready') {
            const { code: accessCode } =
              await hostingApi.getShipAccessCode(shipId);
            const shipUrl = getShipUrl(shipId);
            const authCookie = await getLandscapeAuthCookie(
              shipUrl,
              accessCode
            );
            if (authCookie) {
              if (await isEulaAgreed()) {
                setShip({
                  ship: shipId,
                  shipUrl,
                  authCookie,
                  authType: 'hosted',
                });

                const hasSignedUp = await didSignUp.getValue();
                if (!hasSignedUp) {
                  logger.trackEvent(AnalyticsEvent.LoggedInBeforeSignup);
                }
              } else {
                throw new Error(
                  'Please agree to the End User License Agreement to continue.'
                );
              }
            } else {
              throw new Error(
                `Sorry, we couldn't log you into your Tlon account.`
              );
            }
          } else {
            navigation.navigate('ReserveShip', { user });
          }
        } else {
          throw new Error(
            "Sorry, we couldn't find an active Tlon ship for your account."
          );
        }
      } else {
        signupContext.setOnboardingValues({
          phoneNumber:
            otpMethod === 'phone' ? signupContext.phoneNumber! : undefined,
          email: otpMethod === 'email' ? signupContext.email! : undefined,
        });
        navigation.navigate('ReserveShip', { user });
      }
    },
    [hostingApi, navigation, otpMethod, setShip, signupContext]
  );

  const handleSubmit = useCallback(
    async (code: string) => {
      setIsSubmitting(true);
      await setEulaAgreed();
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
        setError(e.message);
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
