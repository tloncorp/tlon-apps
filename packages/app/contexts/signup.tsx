import { createDevLogger } from '@tloncorp/shared/dist';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import { useBootSequence } from '../hooks/useBootSequence';
import { NodeBootPhase } from '../lib/bootHelpers';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

export const SignupProvider = ({ children }: { children: React.ReactNode }) => {
  const [values, setValues] = useState<SignupValues>(defaultValues);
  const { bootPhase } = useBootSequence(values.hostingUser);

  const isOngoing = useMemo(() => {
    return (
      values.didBeginSignup &&
      (!values.didCompleteSignup || bootPhase !== NodeBootPhase.READY)
    );
  }, [values.didBeginSignup, values.didCompleteSignup, bootPhase]);

  const setDidCompleteSignup = useCallback((value: boolean) => {
    setValues((current) => ({
      ...current,
      didCompleteSignup: value,
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

  const setDidSignup = useCallback((didBeginSignup: boolean) => {
    setValues((current) => ({
      ...current,
      didBeginSignup,
    }));
  }, []);

  const clear = useCallback(() => {
    setValues(defaultValues);
  }, []);

  return (
    <SignupContext.Provider
      value={{
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
