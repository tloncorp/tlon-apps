import NetInfo from '@react-native-community/netinfo';
import { FORCE_SPLASH_SEQUENCE } from '@tloncorp/app/constants';
import { useShip } from '@tloncorp/app/contexts/ship';
import { useConfigureUrbitClient } from '@tloncorp/app/hooks/useConfigureUrbitClient';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useSignupContext } from '../lib/signupContext';

const logger = createDevLogger('splashscreen', false);
type RevivalFlagClearState = 'idle' | 'pending' | 'cleared';

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
      signupContext.isGuidedLogin ||
      signupContext.onboardingFlow
    );
  }, [
    signupContext.email,
    signupContext.phoneNumber,
    signupContext.isGuidedLogin,
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
  const revivalFlagClearStateRef = useRef<RevivalFlagClearState>('idle');
  const wasShowingRevivalSplashRef = useRef(false);
  const showSplashSequence = useMemo(() => {
    return showAuthenticatedApp && (forcedSplash || needsSplashSequence);
  }, [showAuthenticatedApp, forcedSplash, needsSplashSequence]);
  const activeSplashSequenceMode = needsSplashSequence
    ? splashSequenceMode
    : undefined;
  const showingRevivalSplash =
    !!needsSplashSequence &&
    (splashSequenceMode === 'traditionalRevival' ||
      splashSequenceMode === 'tlonbotRevival');

  useEffect(() => {
    if (
      showingRevivalSplash &&
      !wasShowingRevivalSplashRef.current &&
      revivalFlagClearStateRef.current !== 'pending'
    ) {
      revivalFlagClearStateRef.current = 'idle';
    }

    wasShowingRevivalSplashRef.current = showingRevivalSplash;
  }, [showingRevivalSplash]);

  const handleClearSplash = useCallback(() => {
    const completedSplashMode = activeSplashSequenceMode;
    setForcedSplash(false);
    clearNeedsSplashSequence();

    const shouldClearRevivalFlagAfterSplash =
      completedSplashMode === 'traditionalRevival';
    if (
      shouldClearRevivalFlagAfterSplash &&
      revivalFlagClearStateRef.current === 'idle'
    ) {
      revivalFlagClearStateRef.current = 'pending';
      store
        .clearShipRevivalStatus()
        .then(() => {
          revivalFlagClearStateRef.current = 'cleared';
          logger.trackEvent('Toggled Hosting Revival Status', {
            splashSequenceMode: completedSplashMode,
          });
        })
        .catch((error) => {
          revivalFlagClearStateRef.current = 'idle';
          logger.trackError('Failed to clear revival status', {
            error,
            splashSequenceMode: completedSplashMode,
          });
        });
    }
  }, [activeSplashSequenceMode, clearNeedsSplashSequence]);

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
