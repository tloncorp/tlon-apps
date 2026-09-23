import { useAsyncStorageDevTools } from '@dev-plugins/async-storage';
import { useReactNavigationDevTools } from '@dev-plugins/react-navigation';
import { useReactQueryDevTools } from '@dev-plugins/react-query';
import {
  NavigationContainer,
  NavigationContainerRefWithCurrent,
  NavigationState,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import ErrorBoundary from '@tloncorp/app/ErrorBoundary';
import { BranchProvider } from '@tloncorp/app/contexts/branch';
import { useShip } from '@tloncorp/app/contexts/ship';
import { RequiredUpdateScreen } from '@tloncorp/app/features/RequiredUpdateScreen';
import { findAgentGroupOnboardingStartupRoute } from '@tloncorp/app/hooks/useAgentGroupOnboardingLock';
import { markNavigationRestored } from '@tloncorp/app/navigation/navigationRestore';
import { useIsDarkMode } from '@tloncorp/app/hooks/useDarkMode';
import { useHandleLogout } from '@tloncorp/app/hooks/useHandleLogout';
import { useNavigationLogging } from '@tloncorp/app/hooks/useNavigationLogger';
import { useRequiredUpdate } from '@tloncorp/app/hooks/useRequiredUpdate';
import { useResetDb } from '@tloncorp/app/hooks/useResetDb';
import { useMigrations } from '@tloncorp/app/lib/nativeDb';
import { splashScreenProgress } from '@tloncorp/app/lib/splashscreen';
import { useAppNavigationTheme } from '@tloncorp/app/navigation/useAppNavigationTheme';
import { AppDataProvider } from '@tloncorp/app/provider/AppDataProvider';
import { BaseProviderStack } from '@tloncorp/app/provider/BaseProviderStack';
import {
  AgentOnboardingSequence,
  EmailSupportLink,
  LoadingSpinner,
  SplashSequence,
  Text,
  View,
  YStack,
  usePreloadedEmojis,
} from '@tloncorp/app/ui';
import { FeatureFlagConnectedInstrumentationProvider } from '@tloncorp/app/utils/perf';
import { posthog } from '@tloncorp/app/utils/posthog';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { withRetry } from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { OnboardingStack } from './OnboardingStack';
import AuthenticatedApp from './components/AuthenticatedApp';
import { useTopLevelRouting } from './hooks/useTopLevelRouting';
import { registerBackgroundSyncTask } from './lib/backgroundSync';
import { inviteSystemContacts } from './lib/contactsHelpers';
import {
  getFocusedTopLevelTab,
  isRestorableNavigationState,
  sanitizeNavigationStateForPersistence,
} from './lib/navigationStatePersistence';
import { setActiveNotificationRoute } from './lib/notificationPresentation';
import { SignupProvider } from './lib/signupContext';

const splashscreenLogger = createDevLogger('splashscreen', false);
const navigationStateLogger = createDevLogger('navigationState', false);

if (Platform.OS === 'ios') {
  SplashScreen.preventAutoHideAsync().catch((err) => {
    console.warn('Failed to prevent auto hide splash screen', err);
  });
}

const useSplashHider = () => {
  const [splashHidden, setSplashHidden] = useState(
    splashScreenProgress.finished
  );

  useEffect(() => {
    const onComplete = () => {
      withRetry(async () => {
        await SplashScreen.hideAsync();
        setSplashHidden(true);
        splashscreenLogger.trackEvent('Splash screen hidden');
      }).catch((err) => {
        // withRetry returns a promise; a try/catch around the call can't
        // observe its rejection
        splashscreenLogger.trackError('Failed to hide splash screen', err);
      });
    };

    // check if progress completed before mounting
    if (splashScreenProgress.finished) {
      onComplete();
      return;
    }

    splashScreenProgress.emitter.on('complete', onComplete);

    return () => {
      splashScreenProgress.emitter.off('complete', onComplete);
    };
  }, []);

  return splashHidden;
};

// Android notification tap handler passes initial params here
const App = () => {
  const isDarkMode = useIsDarkMode();
  const updateRequired = useRequiredUpdate();

  if (updateRequired) {
    return (
      <View height={'100%'} width={'100%'} backgroundColor="$background">
        <RequiredUpdateScreen />
        <StatusBar
          backgroundColor={isDarkMode ? 'black' : 'white'}
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        />
      </View>
    );
  }

  return <MainApp />;
};

const MainApp = () => {
  const isDarkMode = useIsDarkMode();
  const {
    isLoading,
    connected,
    showAuthenticatedApp,
    showSplashSequence,
    forcedSplash,
    activeSplashSequenceMode,
    hostingBotEnabled,
    handleClearSplash,
  } = useTopLevelRouting();
  const authenticatedNavigatorVisible =
    connected && !isLoading && !showSplashSequence && showAuthenticatedApp;
  const resetDb = useResetDb();
  const handleLogout = useHandleLogout({ resetDb });
  const handleSessionLogout = useCallback(async () => {
    await db.clearSessionStorageItems();
    await handleLogout();
  }, [handleLogout]);

  usePreloadedEmojis();

  useEffect(() => {
    registerBackgroundSyncTask();
  }, []);

  useEffect(() => {
    if (!authenticatedNavigatorVisible) {
      setActiveNotificationRoute(undefined);
    }
  }, [authenticatedNavigatorVisible]);

  useEffect(() => () => setActiveNotificationRoute(undefined), []);

  const splash = (
    <SplashSequence
      onCompleted={handleClearSplash}
      inviteSystemContacts={inviteSystemContacts}
      hostingBotEnabled={hostingBotEnabled}
      splashSequenceMode={activeSplashSequenceMode}
      onLogout={handleSessionLogout}
    />
  );
  const offline = (
    <YStack
      height="100%"
      padding="$l"
      gap="$3xl"
      justifyContent="center"
      alignItems="center"
    >
      <Text textAlign="center" fontSize="$xl" color="$primaryText">
        You are offline. Please connect to the internet and try again.
      </Text>
      <EmailSupportLink
        size="$label/l"
        prompt="Back online and still stuck? Email"
        subject="Help! I can't connect to Tlon."
      />
    </YStack>
  );
  const splashReplacesAuthenticatedApp =
    showSplashSequence &&
    (forcedSplash || activeSplashSequenceMode === 'tlonbotRevival');
  // The revival splash onboards against the ship's desk, so it may only stand
  // in for the app once a clean verdict exists. No verdict means "not probed
  // yet", and the normal path below is what probes — it runs sync start — so a
  // cold start renders that path (its spinner while probing) and hands over to
  // the splash only when the desk is recorded as usable.
  const deskCompat = store.useDeskCompatibility();
  const authenticatedContent = !connected ? (
    offline
  ) : splashReplacesAuthenticatedApp && deskCompat?.status === 'ok' ? (
    <AppDataProvider inviteSystemContacts={inviteSystemContacts}>
      {splash}
    </AppDataProvider>
  ) : undefined;
  const authenticatedOverlay =
    connected && showSplashSequence && !splashReplacesAuthenticatedApp ? (
      <View
        position="absolute"
        top={0}
        right={0}
        bottom={0}
        left={0}
        zIndex={1}
        backgroundColor="$background"
      >
        <AppDataProvider inviteSystemContacts={inviteSystemContacts}>
          <AgentOnboardingSequence
            onCompleted={handleClearSplash}
            fallback={splash}
          />
        </AppDataProvider>
      </View>
    ) : undefined;

  return (
    <View height={'100%'} width={'100%'} backgroundColor="$background">
      {isLoading ? (
        <View flex={1} alignItems="center" justifyContent="center">
          <LoadingSpinner />
        </View>
      ) : showAuthenticatedApp ? (
        <AuthenticatedApp
          connected={connected}
          onLogout={handleSessionLogout}
          authenticatedContent={authenticatedContent}
          authenticatedOverlay={authenticatedOverlay}
        />
      ) : connected ? (
        <OnboardingStack />
      ) : (
        offline
      )}
      <StatusBar
        backgroundColor={isDarkMode ? 'black' : 'white'}
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
      />
    </View>
  );
};

type MigrationState = ReturnType<typeof useMigrations>;

export function ConnectedAppContent({
  migrationState,
}: {
  migrationState: MigrationState;
}) {
  const splashIsHidden = useSplashHider();

  return (
    <FeatureFlagConnectedInstrumentationProvider>
      <BaseProviderStack migrationState={migrationState}>
        <ConnectedNavigationContent splashIsHidden={splashIsHidden} />
      </BaseProviderStack>
    </FeatureFlagConnectedInstrumentationProvider>
  );
}

function ConnectedNavigationContent({
  splashIsHidden,
}: {
  splashIsHidden: boolean;
}) {
  const navigationTheme = useAppNavigationTheme();
  const { ship } = useShip();
  const navigationContainerRef = useNavigationContainerRef();
  const routeNameRef = useRef<string>(undefined);
  const navigationLogging = useNavigationLogging();

  // Backgrounded apps get evicted, and the relaunch that follows is a cold
  // start: without this the navigator rebuilds from `initialRouteName` and the
  // user loses their place. Resolved once, before the navigator mounts,
  // because `initialState` is read only on the first render.
  const [restoredState, setRestoredState] = useState<{
    ready: boolean;
    initialState?: NavigationState;
  }>({ ready: false });

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      let initialState: NavigationState | undefined;
      try {
        const [saved, locks, shipInfo] = await Promise.all([
          db.lastNavigationState.getValue(),
          db.agentGroupOnboardingLocks.getValue(true),
          // Not `getCurrentUserId()`: this runs before `configureClient`, so
          // the client has no id yet and would refuse every restore.
          db.shipInfo.getValue(),
        ]);
        // Onboarding owns the root when it has a startup route, and reaches it
        // through `initialRouteName`; restoring over that would drop the user
        // out of a flow they have not finished.
        const onboardingOwnsRoot =
          findAgentGroupOnboardingStartupRoute(locks) != null;
        if (
          !onboardingOwnsRoot &&
          saved != null &&
          isRestorableNavigationState(saved, Date.now(), shipInfo?.ship ?? null)
        ) {
          initialState = saved.state as NavigationState;
          markNavigationRestored(getFocusedTopLevelTab(initialState));
          // The window measures how recently a position was in use, not when
          // it last changed. Only `onStateChange` writes it otherwise, so a
          // restored screen the user reads without navigating away keeps the
          // age it had before the eviction, and a later relaunch refuses it.
          // Issued before the navigator mounts, and `createStorageItem` chains
          // writes in order, so it cannot land on top of a newer position.
          db.lastNavigationState
            .setValue({ ...saved, savedAt: Date.now() })
            .catch((err) => {
              navigationStateLogger.trackError(
                'Failed to refresh restored navigation state',
                { errorKind: err instanceof Error ? err.name : typeof err }
              );
            });
        }
      } catch (err) {
        // A position is a convenience; failing to read one must not stop the
        // app from starting.
        navigationStateLogger.trackError('Failed to restore navigation state', {
          errorKind: err instanceof Error ? err.name : typeof err,
        });
      }
      if (!cancelled) {
        setRestoredState({ ready: true, initialState });
      }
    }

    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const onReady = () => {
    const route = navigationContainerRef.current?.getCurrentRoute();
    routeNameRef.current = route?.name;
    setActiveNotificationRoute(route);

    const state = navigationContainerRef.current?.getState();
    navigationLogging.onReady(state);
  };

  const onStateChange = (state: NavigationState | undefined) => {
    const previousRouteName = routeNameRef.current;
    const route = navigationContainerRef.current?.getCurrentRoute();
    const currentRouteName = route?.name;

    if (currentRouteName != null && previousRouteName !== currentRouteName) {
      posthog?.screen(currentRouteName);
    }

    routeNameRef.current = currentRouteName;
    setActiveNotificationRoute(route);

    navigationLogging.onStateChange(state);

    const position = sanitizeNavigationStateForPersistence(state);
    if (position) {
      db.lastNavigationState
        .setValue({
          savedAt: Date.now(),
          userId: ship ?? null,
          state: position,
        })
        .catch((err) => {
          navigationStateLogger.trackError('Failed to save navigation state', {
            errorKind: err instanceof Error ? err.name : typeof err,
          });
        });
    }
  };

  // The navigator reads `initialState` once, on mount, so it must not mount
  // before the saved position has been read back. Matches the spinner
  // `MigrationCheck` shows just above, so the launch does not flash a blank
  // screen between the two.
  if (!restoredState.ready) {
    return (
      <View flex={1} alignItems="center" justifyContent="center">
        <LoadingSpinner />
      </View>
    );
  }

  return (
    <NavigationContainer
      theme={navigationTheme}
      ref={navigationContainerRef}
      initialState={restoredState.initialState}
      onReady={onReady}
      onStateChange={onStateChange}
      navigationInChildEnabled
    >
      <ErrorBoundary>
        <BranchProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <SignupProvider>
              {splashIsHidden ? <App /> : null}

              {__DEV__ && (
                <DevTools navigationContainerRef={navigationContainerRef} />
              )}
            </SignupProvider>
          </GestureHandlerRootView>
        </BranchProvider>
      </ErrorBoundary>
    </NavigationContainer>
  );
}

export default function ConnectedApp() {
  const migrationState = useMigrations();

  return <ConnectedAppContent migrationState={migrationState} />;
}

// This is rendered as a component because I didn't have any better ideas
// on calling these hooks conditionally.
const DevTools = ({
  navigationContainerRef,
}: {
  navigationContainerRef: NavigationContainerRefWithCurrent<any>;
}) => {
  const queryClient = useQueryClient();
  useAsyncStorageDevTools();
  useReactQueryDevTools(queryClient);
  useReactNavigationDevTools(navigationContainerRef);
  return null;
};
