import { createDevLogger } from '@tloncorp/shared/dist';
import * as api from '@tloncorp/shared/dist/api';
import { NodeBootPhase } from '@tloncorp/shared/dist/logic';
import * as store from '@tloncorp/shared/dist/store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useBootSequence } from '../hooks/useBootSequence';
import { connectNotifyProvider } from '../lib/notificationsApi';

const logger = createDevLogger('signup', true);

export interface SignupParams {
  nickname?: string;
  notificationToken?: string;
  telemetry?: boolean;
  didBeginSignup?: boolean;
  didCompleteSignup?: boolean;
  isOngoing?: boolean;
  hostingUser: { id: string } | null;
  reservedNodeId: string | null;
  bootPhase: NodeBootPhase;
  userWasReadyAt?: number;
}

type SignupValues = Omit<SignupParams, 'bootPhase'>;
const defaultValues: SignupValues = {
  nickname: undefined,
  hostingUser: null,
  reservedNodeId: null,
};

interface SignupContext extends SignupParams {
  setHostingUser: (hostingUser: { id: string }) => void;
  setNickname: (nickname: string | undefined) => void;
  setNotificationToken: (notificationToken: string | undefined) => void;
  setTelemetry: (telemetry: boolean) => void;
  setDidSignup: (didSignup: boolean) => void;
  setDidCompleteSignup: (value: boolean) => void;
  clear: () => void;
}

const defaultMethods = {
  setNickname: () => {},
  setNotificationToken: () => {},
  setTelemetry: () => {},
  setDidSignup: () => {},
  setHostingUser: () => {},
  setDidCompleteSignup: () => {},
  clear: () => {},
};

const SignupContext = createContext<SignupContext>({
  ...defaultValues,
  ...defaultMethods,
  bootPhase: NodeBootPhase.IDLE,
});

export const SignupProvider = ({
  children,
  fixtureMode,
}: {
  children: React.ReactNode;
  fixtureMode?: boolean;
}) => {
  const [values, setValues] = useState<SignupValues>(defaultValues);
  const { bootPhase, bootReport } = useBootSequence(values);

  const isOngoing = useMemo(() => {
    return (
      values.didBeginSignup &&
      (!values.didCompleteSignup || bootPhase !== NodeBootPhase.READY)
    );
  }, [values.didBeginSignup, values.didCompleteSignup, bootPhase]);

  const setDidSignup = useCallback((didBeginSignup: boolean) => {
    setValues((current) => ({
      ...current,
      didBeginSignup,
    }));
  }, []);

  const setDidCompleteSignup = useCallback((value: boolean) => {
    setValues((current) => ({
      ...current,
      didCompleteSignup: value,
      userWasReadyAt: Date.now(),
    }));
  }, []);

  const setHostingUser = useCallback((hostingUser: { id: string }) => {
    setValues((current) => ({
      ...current,
      hostingUser,
    }));
  }, []);

  const setNickname = useCallback((nickname: string | undefined) => {
    setValues((current) => ({
      ...current,
      nickname,
    }));
  }, []);

  const setNotificationToken = useCallback(
    (notificationToken: string | undefined) => {
      setValues((current) => ({
        ...current,
        notificationToken,
      }));
    },
    []
  );

  const setTelemetry = useCallback((telemetry: boolean) => {
    setValues((current) => ({
      ...current,
      telemetry,
    }));
  }, []);

  const clear = useCallback(() => {
    logger.log('clearing signup context');
    setValues(defaultValues);
  }, []);

  useEffect(() => {
    if (
      values.didBeginSignup &&
      values.didCompleteSignup &&
      bootPhase === NodeBootPhase.READY
    ) {
      logger.log('running post-signup actions');
      const postSignupParams = {
        nickname: values.nickname,
        telemetry: values.telemetry,
        notificationToken: values.notificationToken,
      };
      handlePostSignup(postSignupParams);
      clear();
      logger.trackEvent('hosted signup report', {
        bootDuration: bootReport
          ? bootReport.completedAt - bootReport.startedAt
          : null,
        userSatWaitingFor: values.userWasReadyAt
          ? Date.now() - values.userWasReadyAt
          : null,
        timeUnit: 'ms',
      });
    }
  }, [values, bootPhase, clear, bootReport]);

  const prodValues = {
    ...values,
    bootPhase,
    isOngoing,
    setHostingUser,
    setNickname,
    setNotificationToken,
    setTelemetry,
    setDidSignup,
    setDidCompleteSignup,
    clear,
  };

  const fixtureValues: SignupContext = {
    hostingUser: { id: 'placeholder' },
    bootPhase: NodeBootPhase.CONNECTING,
    didBeginSignup: true,
    isOngoing: true,
    reservedNodeId: '~latter-bolden',
    setDidCompleteSignup: () => {},
    setDidSignup: () => {},
    setHostingUser: () => {},
    setNickname: () => {},
    setNotificationToken: () => {},
    setTelemetry: () => {},
    clear: () => {},
  };

  return (
    <SignupContext.Provider value={fixtureMode ? fixtureValues : prodValues}>
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

async function handlePostSignup(params: {
  nickname?: string;
  telemetry?: boolean;
  notificationToken?: string;
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
