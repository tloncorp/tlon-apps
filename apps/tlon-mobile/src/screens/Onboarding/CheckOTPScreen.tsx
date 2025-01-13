import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSignupParams } from '@tloncorp/app/contexts/branch';
import { useShip } from '@tloncorp/app/contexts/ship';
import { trackOnboardingAction } from '@tloncorp/app/utils/posthog';
import { getShipUrl } from '@tloncorp/app/utils/ship';
import {
  AnalyticsEvent,
  HostedNodeStatus,
  createDevLogger,
} from '@tloncorp/shared';
import { HostingError, logInHostingUser } from '@tloncorp/shared/api';
import { getLandscapeAuthCookie } from '@tloncorp/shared/api';
import { storage } from '@tloncorp/shared/db';
import * as db from '@tloncorp/shared/db';
import { ScreenHeader, TlonText, View, YStack, useStore } from '@tloncorp/ui';
import { useCallback, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { OTPInput } from '../../components/OnboardingInputs';
import { useOnboardingHelpers } from '../../hooks/useOnboardingHelpers';
import { useRecaptcha } from '../../hooks/useRecaptcha';
import { useOnboardingContext } from '../../lib/OnboardingContext';
import { useSignupContext } from '../../lib/signupContext';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'CheckOTP'>;

const EMAIL_CODE_LENGTH = 6;
const PHONE_CODE_LENGTH = 6;

const logger = createDevLogger('CheckOTP', true);

export const CheckOTPScreen = ({ navigation, route: { params } }: Props) => {
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
    async (otpCode: string) => {
      try {
        const recaptchaToken = await recaptcha.getToken();
        if (!recaptchaToken) {
          setError(`We're having trouble confirming you're human. (reCAPTCHA)`);
          throw new Error('reCAPTCHA token not available');
        }

        const user = await hostingApi.signUpHostingUser({
          otp: otpCode,
          lure: signupParams.lureId,
          priorityToken: signupParams.priorityToken,
          recaptchaToken,
          ...accountCreds,
        });
        trackOnboardingAction({
          actionName: 'Verification Submitted',
          ...accountCreds,
        });
        trackOnboardingAction({
          actionName: 'Account Created',
          lure: signupParams.lureId,
          ...accountCreds,
        });
        return user;
      } catch (err) {
        logger.trackError('Error signing up user', {
          errorMessage: err.message,
          errorStack: err.stack,
          ...accountCreds,
        });
        throw err;
      }
    },
    [
      accountCreds,
      hostingApi,
      recaptcha,
      signupParams.lureId,
      signupParams.priorityToken,
    ]
  );

  // const handleLogin = useCallback(
  //   async (otp: string) => {
  //     const eulaAgreed = await storage.eulaAgreed.getValue();
  //     if (!eulaAgreed) {
  //       throw new Error(
  //         'Please agree to the End User License Agreement to continue.'
  //       );
  //     }

  //     // Step 1: Attempt login and handle account issues
  //     const maybeAccountIssue = await store.logInHostedUser({
  //       otp,
  //       ...accountCreds,
  //     });
  //     if (maybeAccountIssue) {
  //       switch (maybeAccountIssue) {
  //         // If the account has no assigned ship, treat it as a signup
  //         case store.HostingAccountIssue.NoAssignedShip:
  //           signupContext.setOnboardingValues(accountCreds);
  //           navigation.navigate('ReserveShip');
  //           break;
  //         case store.HostingAccountIssue.RequiresVerification:
  //           // TODO: redirect to verification
  //           break;
  //       }
  //     }

  //     // Step 2: Verify node status
  //     const nodeStatus = await store.checkHostingNodeStatus();
  //     if (nodeStatus !== HostedNodeStatus.Running) {
  //       navigation.navigate('GettingNodeReadyScreen', {
  //         waitType: nodeStatus,
  //       });
  //     }

  //     // Step 3: Authenticate with node
  //     const shipInfo = await store.authenticateWithReadyNode();
  //     if (!shipInfo) {
  //       logger.trackError(AnalyticsEvent.LoginAnomaly, {
  //         context: 'Failed to authenticate.',
  //       });
  //       throw new Error(
  //         'Could not authenticate with your P2P node, please try again.'
  //       );
  //     }

  //     ///////////////////////

  //     const user = await hostingApi.logInHostingUser({
  //       otp,
  //       ...accountCreds,
  //     });

  //     logger.trackEvent('Authenticated with hosting', accountCreds);
  //     db.haveHostedLogin.setValue(true);

  //     console.log(`bl: got user`, user);
  //     if (user.ships.length > 0) {
  //       db.hostedAccountIsInitialized.setValue(true);
  //       const nodeId = user.ships[0];
  //       db.hostedUserNodeId.setValue(nodeId);

  //       const shipsWithStatus = await hostingApi.getShipsWithStatus([nodeId]);
  //       if (shipsWithStatus) {
  //         const { status, shipId } = shipsWithStatus;
  //         if (status === 'Ready') {
  //           const { code: accessCode } =
  //             await hostingApi.getShipAccessCode(shipId);
  //           const shipUrl = getShipUrl(shipId);
  //           const authCookie = await getLandscapeAuthCookie(
  //             shipUrl,
  //             accessCode
  //           );
  //           if (authCookie) {
  //             if (await storage.eulaAgreed.getValue()) {
  //               setShip({
  //                 ship: shipId,
  //                 shipUrl,
  //                 authCookie,
  //                 authType: 'hosted',
  //               });

  //               const hasSignedUp = await storage.didSignUp.getValue();
  //               if (!hasSignedUp) {
  //                 logger.trackEvent(AnalyticsEvent.LoggedInBeforeSignup);
  //               }
  //             } else {
  //               throw new Error(
  //                 'Please agree to the End User License Agreement to continue.'
  //               );
  //             }
  //           } else {
  //             throw new Error(
  //               `Sorry, we couldn't log you into your Tlon account.`
  //             );
  //           }
  //         } else {
  //           logger.trackEvent(AnalyticsEvent.LoginAnomaly, {
  //             context: 'User logged in, but node is not running',
  //             ...accountCreds,
  //           });
  //           navigation.navigate('GettingNodeReadyScreen', {
  //             waitType: 'Paused',
  //           });
  //         }
  //       } else {
  //         throw new Error(
  //           "Sorry, we couldn't find an active Tlon ship for your account."
  //         );
  //       }
  //     } else {
  //       logger.trackEvent(AnalyticsEvent.LoginAnomaly, {
  //         context: 'User has no assigned node',
  //         ...accountCreds,
  //       });
  //       signupContext.setOnboardingValues({
  //         phoneNumber:
  //           otpMethod === 'phone' ? signupContext.phoneNumber! : undefined,
  //         email: otpMethod === 'email' ? signupContext.email! : undefined,
  //         // hostingUser: user,
  //       });
  //       navigation.navigate('ReserveShip');
  //     }
  //   },
  //   [accountCreds, hostingApi, navigation, otpMethod, setShip, signupContext]
  // );

  const handleSubmit = useCallback(
    async (code: string) => {
      setIsSubmitting(true);
      await storage.eulaAgreed.setValue(true);
      try {
        if (mode === 'signup') {
          await handleSignup(code);
          signupContext.kickOffBootSequence();
          navigation.navigate('SetNickname');
        } else {
          await handleLogin({ otp: code, ...accountCreds });
        }
      } catch (e) {
        setError(e.message);
        logger.trackError(`Error Logging In`, {
          errorMessage: e.message,
          errorStack: e.stack,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [accountCreds, handleLogin, handleSignup, mode, navigation, signupContext]
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
          platform: Platform.OS,
        });
      } else {
        await apiCall({
          phoneNumber: params.phoneNumber ?? signupContext.phoneNumber!,
          recaptchaToken,
          platform: Platform.OS,
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
