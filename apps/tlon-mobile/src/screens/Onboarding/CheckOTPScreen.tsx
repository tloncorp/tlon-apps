import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  useLureMetadata,
  useSignupParams,
} from '@tloncorp/app/contexts/branch';
import {
  ScreenHeader,
  TlonText,
  View,
  YStack,
  useStore,
} from '@tloncorp/app/ui';
import { trackOnboardingAction } from '@tloncorp/app/utils/posthog';
import {
  AnalyticsEvent,
  AnalyticsSeverity,
  createDevLogger,
} from '@tloncorp/shared';
import { HostingError } from '@tloncorp/shared/api';
import { storage } from '@tloncorp/shared/db';
import { useCallback, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { OTPInput } from '../../components/OnboardingInputs';
import { useOnboardingHelpers } from '../../hooks/useOnboardingHelpers';
import { useRecaptcha } from '../../hooks/useRecaptcha';
import { useOnboardingContext } from '../../lib/OnboardingContext';
import {
  clearHostingNativeCookie,
  selectRecaptchaPlatform,
} from '../../lib/hostingAuth';
import { useSignupContext } from '../../lib/signupContext';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'CheckOTP'>;

const EMAIL_CODE_LENGTH = 6;
const PHONE_CODE_LENGTH = 6;

const logger = createDevLogger('CheckOTP', true);

export const CheckOTPScreen = ({ navigation, route: { params } }: Props) => {
  const store = useStore();
  const [otp, setOtp] = useState<string[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { hostingApi } = useOnboardingContext();
  const signupContext = useSignupContext();
  const signupParams = useSignupParams();
  const { handleLogin } = useOnboardingHelpers();
  const { otpMethod, mode } = params;
  const recaptcha = useRecaptcha();
  const codeLength =
    otpMethod === 'email' ? EMAIL_CODE_LENGTH : PHONE_CODE_LENGTH;
  const inviteMetadata = useLureMetadata();

  const accountCreds = useMemo(
    () => ({
      phoneNumber:
        otpMethod === 'phone'
          ? params.phoneNumber ?? signupContext.phoneNumber!
          : undefined,
      email:
        otpMethod === 'email'
          ? params.email ?? signupContext.email!
          : undefined,
    }),
    [
      otpMethod,
      params.email,
      params.phoneNumber,
      signupContext.email,
      signupContext.phoneNumber,
    ]
  );

  const handleSignup = useCallback(
    async (otp: string) => {
      try {
        const token = await recaptcha.getToken();
        if (!token) {
          setError(`We're having trouble confirming you're human. (reCAPTCHA)`);
          throw new Error('reCAPTCHA token not available');
        }
        const recaptchaInfo = {
          token,
          platform: selectRecaptchaPlatform(),
        };

        const maybeAccountIssue = await store.signUpHostedUser({
          otp,
          inviteId: signupParams.lureId,
          priorityToken: signupParams.priorityToken,
          recaptcha: recaptchaInfo,
          ...accountCreds,
        });

        // clear hosting cookie since we manage manually
        await clearHostingNativeCookie();

        trackOnboardingAction({
          actionName: 'Verification Submitted',
          ...accountCreds,
        });
        trackOnboardingAction({
          actionName: 'Account Created',
          lure: signupParams.lureId,
          inviteId: inviteMetadata?.id,
          inviteType: inviteMetadata?.inviteType,
          invitedGroupId: inviteMetadata?.invitedGroupId,
          invitedGroupTitle: inviteMetadata?.invitedGroupTitle,
          inviterNickname: inviteMetadata?.inviterNickname,
          inviterUserId: inviteMetadata?.inviterUserId,
          ...accountCreds,
        });

        return maybeAccountIssue;
      } catch (err) {
        logger.trackError('Error signing up user', {
          errorMessage: err.message,
          errorStack: err.stack,
          severity: AnalyticsSeverity.Critical,
          ...accountCreds,
        });
        throw err;
      }
    },
    [
      accountCreds,
      inviteMetadata,
      recaptcha,
      signupParams.lureId,
      signupParams.priorityToken,
      store,
    ]
  );

  const handleSubmit = useCallback(
    async (code: string) => {
      setIsSubmitting(true);
      await storage.eulaAgreed.setValue(true);
      try {
        if (mode === 'signup') {
          const maybeAccountIssue = await handleSignup(code);
          if (
            maybeAccountIssue === store.HostingAccountIssue.RequiresVerification
          ) {
            navigation.navigate('RequestPhoneVerify', { mode: params.mode });
            return;
          }
          if (maybeAccountIssue === store.HostingAccountIssue.NoInventory) {
            logger.trackError(AnalyticsEvent.InvitedUserFailedInventoryCheck, {
              severity: AnalyticsSeverity.Critical,
            });
            navigation.navigate('JoinWaitList', {});
            return;
          }
          signupContext.kickOffBootSequence();
          navigation.navigate('SetNickname');
        } else {
          await handleLogin({ otp: code, ...accountCreds });
        }
      } catch (e) {
        const SIGNUP_OTP_INCORRECT_STATUS = 400;
        const LOGIN_OTP_INCORRECT_STATUS = 401;
        if (
          e instanceof HostingError &&
          [SIGNUP_OTP_INCORRECT_STATUS, LOGIN_OTP_INCORRECT_STATUS].includes(
            e.details.status ?? 0
          )
        ) {
          setError('Confirmation code is incorrect or expired.');
        } else {
          setError(e.message);
          logger.trackError(
            `Error ${mode === 'signup' ? 'Signing Up' : 'Logging In'}`,
            {
              errorMessage: e.message,
              errorStack: e.stack,
              details: e.details,
            }
          );
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      accountCreds,
      handleLogin,
      handleSignup,
      mode,
      navigation,
      params.mode,
      signupContext,
      store.HostingAccountIssue.NoInventory,
      store.HostingAccountIssue.RequiresVerification,
    ]
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
      setError(undefined);
      setOtp([]);
      const recaptchaToken = await recaptcha.getToken();
      if (!recaptchaToken) {
        setError(`We're having trouble confirming you're human. (reCAPTCHA)`);
        return;
      }
      const apiCall =
        mode === 'signup'
          ? hostingApi.requestSignupOtp
          : hostingApi.requestLoginOtp;
      if (otpMethod === 'email') {
        await apiCall({
          email: params.email ?? signupContext.email!,
          recaptchaToken,
          platform: selectRecaptchaPlatform(),
        });
      } else {
        await apiCall({
          phoneNumber: params.phoneNumber ?? signupContext.phoneNumber!,
          recaptchaToken,
          platform: selectRecaptchaPlatform(),
        });
      }
    } catch (err) {
      if (err instanceof HostingError) {
        if (err.details.status === 429) {
          logger.trackEvent('OTP re-request rate limited');
          setError('Must wait before requesting another code.');
        }
      } else {
        setError('An error occurred. Please try again.');
        logger.trackError('Error requesting OTP resend', {
          errorMessage: err.message,
          errorStack: err.stack,
        });
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
