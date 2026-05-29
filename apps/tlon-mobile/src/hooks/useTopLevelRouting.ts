import NetInfo from '@react-native-community/netinfo';
import { FORCE_SPLASH_SEQUENCE } from '@tloncorp/app/constants';
import { useShip } from '@tloncorp/app/contexts/ship';
import { useConfigureUrbitClient } from '@tloncorp/app/hooks/useConfigureUrbitClient';
import * as db from '@tloncorp/shared/db';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useSignupContext } from '../lib/signupContext';

export function useTopLevelRouting() {
  const {
    isLoading,
    isAuthenticated,
    needsSplashSequence,
    splashSequenceMode,
    clearNeedsSplashSequence,
  } = useShip();
  const signupContext = useSignupContext();
  const connected = useNetworkConnection();

  const finishingSelfHostedLogin = db.finishingSelfHostedLogin.useValue();
  const haveHostedLogin = db.haveHostedLogin.useValue();
  const hostedAccountInitialized = db.hostedAccountIsInitialized.useValue();
  const hostedNodeRunning = db.hostedNodeIsRunning.useValue();
  const hostingBotEnabled = db.hostingBotEnabled.useValue();

  const currentlyOnboarding = useMemo(() => {
    return (
      signupContext.email ||
      signupContext.phoneNumber ||
      signupContext.onboardingFlow
    );
  }, [
    signupContext.email,
    signupContext.phoneNumber,
    signupContext.onboardingFlow,
  ]);

  const showAuthenticatedApp = useMemo(() => {
    const blockedOnSignup = currentlyOnboarding;
    const blockedOnLoginHosted =
      haveHostedLogin && (!hostedAccountInitialized || !hostedNodeRunning);
    const blockedOnLoginSelfHosted = finishingSelfHostedLogin;
    return (
      isAuthenticated &&
      !blockedOnSignup &&
      !blockedOnLoginHosted &&
      !blockedOnLoginSelfHosted
    );
  }, [
    currentlyOnboarding,
    haveHostedLogin,
    hostedAccountInitialized,
    hostedNodeRunning,
    finishingSelfHostedLogin,
    isAuthenticated,
  ]);

  // FORCE_SPLASH_SEQUENCE triggers the splash on first render but doesn't
  // prevent it from being dismissed; clearNeedsSplashSequence still works.
  const [forcedSplash, setForcedSplash] = useState(FORCE_SPLASH_SEQUENCE);
  const showSplashSequence = useMemo(() => {
    return showAuthenticatedApp && (forcedSplash || needsSplashSequence);
  }, [showAuthenticatedApp, forcedSplash, needsSplashSequence]);
  const activeSplashSequenceMode = needsSplashSequence
    ? splashSequenceMode
    : undefined;

  const handleClearSplash = useCallback(() => {
    setForcedSplash(false);
    clearNeedsSplashSequence();
  }, [clearNeedsSplashSequence]);

  // Splash renders instead of AuthenticatedApp, which is where the urbit
  // client is normally configured. The splash hits APIs that read the current
  // user via the urbit client, so configure it here too.
  const configureClient = useConfigureUrbitClient();
  useEffect(() => {
    if (showSplashSequence) {
      configureClient();
    }
  }, [showSplashSequence, configureClient]);

  return {
    connected,
    isLoading,
    showAuthenticatedApp,
    showSplashSequence,
    activeSplashSequenceMode,
    hostingBotEnabled: hostingBotEnabled ?? false,
    handleClearSplash,
  };
}

function useNetworkConnection() {
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    const unsubscribeFromNetInfo = NetInfo.addEventListener(
      ({ isConnected }) => {
        setConnected(isConnected ?? true);
      }
    );

    return () => {
      unsubscribeFromNetInfo();
    };
  }, []);

  return connected;
}
