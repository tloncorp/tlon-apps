import { createContext, useCallback, useContext, useState } from 'react';

interface SignupValues {
  nickname?: string;
  notificationToken?: string;
  telemetry?: boolean;
  didSignup?: boolean;
}

interface SignupContext extends SignupValues {
  setNickname: (nickname: string | undefined) => void;
  setNotificationToken: (notificationToken: string | undefined) => void;
  setTelemetry: (telemetry: boolean) => void;
  setDidSignup: (didSignup: boolean) => void;
  clear: () => void;
}

const defaultContext = {
  nickname: undefined,
  setNickname: () => {},
  setNotificationToken: () => {},
  setTelemetry: () => {},
  setDidSignup: () => {},
  clear: () => {},
};

const SignupContext = createContext<SignupContext>(defaultContext);

export const SignupProvider = ({ children }: { children: React.ReactNode }) => {
  const [values, setValues] = useState<SignupValues>({});

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

  const setDidSignup = useCallback((didSignup: boolean) => {
    setValues((current) => ({
      ...current,
      didSignup,
    }));
  }, []);

  const clear = useCallback(() => {
    setValues({});
  }, []);

  return (
    <SignupContext.Provider
      value={{
        ...values,
        setNickname,
        setNotificationToken,
        setTelemetry,
        setDidSignup,
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
