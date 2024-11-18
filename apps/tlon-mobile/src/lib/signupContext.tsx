// This signup context lives here in the mobile app because this path can only
// be reached by the mobile app and it's only used by the mobile app.
import { useBootSequence } from '@tloncorp/app/hooks/useBootSequence';
import { NodeBootPhase } from '@tloncorp/app/lib/bootHelpers';
import { connectNotifyProvider } from '@tloncorp/app/lib/notificationsApi';
import { createDevLogger } from '@tloncorp/shared';
import * as api from '@tloncorp/shared/api';
import { SignupParams, didSignUp, signupData } from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import PostHog, { usePostHog } from 'posthog-react-native';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import branch from 'react-native-branch';

const logger = createDevLogger('signup', true);

type SignupValues = Omit<SignupParams, 'bootPhase'>;
const defaultValues: SignupValues = {
  hostingUser: null,
  reservedNodeId: null,
};

interface SignupContext extends SignupParams {
  reviveCheckComplete: boolean;
  setOnboardingValues: (newValues: Partial<SignupValues>) => void;
  markReviveCheckComplete: () => void;
  kickOffBootSequence: () => void;
  handlePostSignup: () => void;
  clear: () => void;
}

const defaultMethods = {
  setOnboardingValues: () => {},
  handlePostSignup: () => {},
  kickOffBootSequence: () => {},
  markReviveCheckComplete: () => {},
  clear: () => {},
};

const SignupContext = createContext<SignupContext>({
  ...defaultValues,
  ...defaultMethods,
  bootPhase: NodeBootPhase.IDLE,
  reviveCheckComplete: false,
});

export const SignupProvider = ({ children }: { children: React.ReactNode }) => {
  const {
    value: values,
    setValue: setValues,
    resetValue: resetValues,
  } = signupData.useStorageItem();
  const [reviveCheckComplete, setReviveCheckComplete] = useState(false);
  const { bootPhase, bootReport, kickOffBootSequence } =
    useBootSequence(values);
  const postHog = usePostHog();

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
  }, [resetValues]);

  const handlePostSignup = useCallback(() => {
    try {
      logger.log('running post-signup actions');
      didSignUp.setValue(true);
      const postSignupParams = {
        nickname: values.nickname,
        telemetry: values.telemetry,
        notificationToken: values.notificationToken,
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
      setTimeout(() => clear(), 2000);
    }
  }, [values, bootReport, clear]);

  useEffect(() => {
    if (values.didCompleteOnboarding && bootPhase === NodeBootPhase.READY) {
      handlePostSignup();
    }
  }, [values, bootPhase, clear, bootReport, handlePostSignup]);

  return (
    <SignupContext.Provider
      value={{
        ...values,
        bootPhase,
        reviveCheckComplete,
        markReviveCheckComplete: () => setReviveCheckComplete(true),
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
      await api.updateTelemetrySetting(params.telemetry);
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
}
