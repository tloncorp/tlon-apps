// This signup context lives here in the mobile app because this path can only
// be reached by the mobile app and it's only used by the mobile app.
import { useBootSequence } from '@tloncorp/app/hooks/useBootSequence';
import { connectNotifyProvider } from '@tloncorp/app/lib/notificationsApi';
import { createDevLogger } from '@tloncorp/shared';
import * as api from '@tloncorp/shared/api';
import { didSignUp, signupData } from '@tloncorp/shared/db';
import {
  AnalyticsEvent,
  AnalyticsSeverity,
  NodeBootPhase,
  SignupParams,
} from '@tloncorp/shared/domain';
import * as store from '@tloncorp/shared/store';
import * as LibPhone from 'libphonenumber-js';
import PostHog, { usePostHog } from 'posthog-react-native';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from 'react';
import branch from 'react-native-branch';

const logger = createDevLogger('signup', true);

type SignupValues = Omit<SignupParams, 'bootPhase'>;
const defaultValues: SignupValues = {
  reservedNodeId: null,
};

interface SignupContext extends SignupParams {
  setOnboardingValues: (newValues: Partial<SignupValues>) => void;
  kickOffBootSequence: () => void;
  handlePostSignup: () => void;
  clear: () => void;
}

const defaultMethods = {
  setOnboardingValues: () => {},
  handlePostSignup: () => {},
  kickOffBootSequence: () => {},
  clear: () => {},
};

const SignupContext = createContext<SignupContext>({
  ...defaultValues,
  ...defaultMethods,
  bootPhase: NodeBootPhase.IDLE,
});

export const SignupProvider = ({ children }: { children: React.ReactNode }) => {
  const {
    value: values,
    setValue: setValues,
    resetValue: resetValues,
  } = signupData.useStorageItem();
  const { bootPhase, bootReport, kickOffBootSequence, resetBootSequence } =
    useBootSequence();
  const postHog = usePostHog();
  const handlingPostSignup = useRef(false);

  const setOnboardingValues = useCallback(
    (newValues: Partial<SignupValues>) => {
      setValues((current) => ({
        ...current,
        ...newValues,
      }));
    },
    [setValues]
  );

  const clear = useCallback(() => {
    logger.log('clearing signup context');
    resetValues();
    handlingPostSignup.current = false;
  }, [resetValues]);

  const handlePostSignup = useCallback(() => {
    try {
      logger.log('running post-signup actions');
      didSignUp.setValue(true);
      const postSignupParams = {
        nickname: values.nickname,
        telemetry: values.telemetry,
        notificationToken: values.notificationToken,
        phoneNumber: values.phoneNumber,
        postHog,
      };
      runPostSignupActions(postSignupParams);
      logger.trackEvent('hosted signup report', {
        bootDuration: bootReport
          ? bootReport.completedAt - bootReport.startedAt
          : null,
        userSatWaitingFor: values.userWasReadyAt
          ? Date.now() - values.userWasReadyAt
          : null,
        timeUnit: 'ms',
      });
    } catch (e) {
      logger.trackError('post signup error', {
        errorMessage: e.message,
        errorStack: e.stack,
      });
    } finally {
      // this is when the UI will transition to authenticated app
      setTimeout(() => {
        clear();
        setTimeout(() => {
          // delay resetting the boot sequence to avoid race conditions
          // with displaying the checkmarks before transitioning
          resetBootSequence();
        }, 1000);
      }, 2000);
    }
  }, [
    values.nickname,
    values.telemetry,
    values.notificationToken,
    values.phoneNumber,
    values.userWasReadyAt,
    postHog,
    bootReport,
    clear,
    resetBootSequence,
  ]);

  useEffect(() => {
    if (
      values.didCompleteOnboarding &&
      bootPhase === NodeBootPhase.READY &&
      !handlingPostSignup.current
    ) {
      handlingPostSignup.current = true;
      handlePostSignup();
    }
  }, [values, bootPhase, clear, bootReport, handlePostSignup]);

  return (
    <SignupContext.Provider
      value={{
        ...values,
        bootPhase,
        setOnboardingValues,
        handlePostSignup,
        kickOffBootSequence,
        clear,
      }}
    >
      {children}
    </SignupContext.Provider>
  );
};

export function useSignupContext() {
  const context = useContext(SignupContext);

  if (!context) {
    throw new Error('useSignupContext must be used within a SignupProvider');
  }

  return context;
}

async function runPostSignupActions(params: {
  nickname?: string;
  telemetry?: boolean;
  phoneNumber?: string;
  notificationToken?: string;
  postHog?: PostHog;
}) {
  if (params.nickname) {
    try {
      await store.updateCurrentUserProfile({
        nickname: params.nickname,
      });
    } catch (e) {
      logger.trackError('post signup: failed to set nickname', {
        errorMessage: e.message,
        errorStack: e.stack,
      });
    }
  }

  if (typeof params.telemetry !== 'undefined') {
    try {
      await api.setSetting('enableTelemetry', params.telemetry);
      if (!params.telemetry) {
        // we give some wiggle room here before disabling telemetry to allow
        // the initial signup flow to complete before severing analytics
        const tenMinutes = 10 * 60 * 1000;
        setTimeout(() => {
          params.postHog?.optOut();
          branch.disableTracking(true);
        }, tenMinutes);
      }
    } catch (e) {
      logger.trackError('post signup: failed to set telemetry', {
        errorMessage: e.message,
        errorStack: e.stack,
      });
    }
  }

  if (params.notificationToken) {
    try {
      await connectNotifyProvider(params.notificationToken);
    } catch (e) {
      logger.trackError('post signup: failed to set notification token', {
        errorMessage: e.message,
        errorStack: e.stack,
      });
    }
  }

  // if a user signed up with a phone number, we need to
  // send register it on the verifier service
  if (params.phoneNumber) {
    try {
      logger.trackEvent(AnalyticsEvent.DebugAttestation, {
        context: 'initiating post-signup phone number registration',
      });
      const parsedPhone = LibPhone.parsePhoneNumberFromString(
        params.phoneNumber
      );
      if (!parsedPhone) {
        logger.trackEvent(AnalyticsEvent.ErrorAttestation, {
          context:
            'user signed up with phone number, but was unable to parse for verification',
        });
        return;
      }
      const normalizedPhone = parsedPhone.format('E.164');
      await store.initiatePhoneAttestation(normalizedPhone);
    } catch (e) {
      logger.trackEvent(AnalyticsEvent.ErrorAttestation, {
        severity: AnalyticsSeverity.Critical,
        context: 'post-signup phone number verification failed',
      });
    }
  }
}
