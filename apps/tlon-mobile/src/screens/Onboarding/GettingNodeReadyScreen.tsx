// tamagui-ignore
import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useShip } from '@tloncorp/app/contexts/ship';
import { useHandleLogout } from '@tloncorp/app/hooks/useHandleLogout';
import { useIsDarkMode } from '@tloncorp/app/hooks/useIsDarkMode';
import { useResetDb } from '@tloncorp/app/hooks/useResetDb';
import {
  NodeResumeState,
  useStoppedNodeSequence,
} from '@tloncorp/app/hooks/useStoppedNodeSequence';
import {
  scheduleNodeResumeNudge,
  useNotificationPermissions,
} from '@tloncorp/app/lib/notifications';
import {
  AppDataContextProvider,
  ArvosDiscussing,
  IconType,
  ListItem,
  LoadingSpinner,
  OnboardingTextBlock,
  ScreenHeader,
  StoppedNodePushSheet,
  TlonText,
  View,
  XStack,
  YStack,
  useStore,
} from '@tloncorp/app/ui';
import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useOnboardingHelpers } from '../../hooks/useOnboardingHelpers';
import { OnboardingStackParamList } from '../../types';

const BOTTOM_WIDGET_TITLES = [
  'Pulling out of storage',
  'Running boot sequence',
  'Establishing a connection',
  'Your node is ready',
];

const BOTTOM_WIDGET_ICONS: IconType[] = [
  'ChannelGalleries',
  'Bang',
  'Link',
  'Face',
];

type Props = NativeStackScreenProps<
  OnboardingStackParamList,
  'GettingNodeReadyScreen'
>;

const logger = createDevLogger('GettingNodeReadyScreen', true);

export function GettingNodeReadyScreen({
  navigation,
  route: { params },
}: Props) {
  const store = useStore();
  const isFocused = useIsFocused();
  const lastWasFocused = useRef(true);
  const { setShip } = useShip();
  const resetDb = useResetDb();
  const handleLogout = useHandleLogout({ resetDb });
  const [loggingOut, setLoggingOut] = useState(false);
  const hostedNodeId = db.hostedUserNodeId.useValue();
  const onboardingHelpers = useOnboardingHelpers();

  // Handle state for the progress indicaors
  const { progress, updateProgress, resetProgress } = useStagedProgress(
    0,
    params.waitType === 'Paused' ? 'fast' : 'slow'
  );

  // Handle notification permissions and sending the node resume nudge
  const notifPerms = useNotificationPermissions();
  const [permSheetOpen, setPermSheetOpen] = useState(true);
  const [permsInitHandled, setPermsInitHandled] = useState(false);
  useEffect(() => {
    // handle initialization
    if (notifPerms.initialized && !permsInitHandled) {
      const shouldPopPermsSheet = !notifPerms.hasPermission;
      setPermSheetOpen(shouldPopPermsSheet);
      setPermsInitHandled(true);
    }
  }, [notifPerms, permsInitHandled]);

  useEffect(() => {
    if (notifPerms.hasPermission && hostedNodeId) {
      scheduleNodeResumeNudge(hostedNodeId).catch((err) => {
        logger.trackEvent(AnalyticsEvent.ErrorNodeResumePush, {
          errorMessage: err.message,
          context: 'while scheduling from GettingNodeReadyScreen',
        });
      });
    }
  }, [hostedNodeId, notifPerms.hasPermission]);

  // Handle stopped node sequence
  const { phase, shipInfo, resetSequence } = useStoppedNodeSequence({
    waitType: params.waitType,
    enabled: isFocused,
  });
  const lastUpdatedPhase = useRef<null | NodeResumeState>(null);
  useEffect(() => {
    if (lastUpdatedPhase.current !== phase) {
      lastUpdatedPhase.current = phase;
      if (phase === NodeResumeState.UnderMaintenance) {
        // Important! Always close the sheet before navigating
        setPermSheetOpen(false);
        setTimeout(() => {
          navigation.navigate('UnderMaintenance');
        }, 200);
      }

      if (phase === NodeResumeState.Authenticating) {
        updateProgress(2);
      }

      if (phase === NodeResumeState.Ready && shipInfo) {
        updateProgress(3);
        // Important! Always close the sheet before navigating
        setPermSheetOpen(false);
        setTimeout(() => {
          setShip(shipInfo);
          if (shipInfo.needsSplashSequence) {
            logger.trackEvent(AnalyticsEvent.WayfindingDebug, {
              context: 'stopped revival ship is now ready, handling',
            });
            onboardingHelpers.handleRevivalLogin(shipInfo);
          }
        }, 2000);
      }
    }
  }, [
    navigation,
    onboardingHelpers,
    phase,
    setShip,
    shipInfo,
    store,
    updateProgress,
  ]);

  // If we came back to this screen, make sure we reset
  useEffect(() => {
    if (isFocused && !lastWasFocused.current) {
      resetProgress();
      resetSequence();
      lastUpdatedPhase.current = null;
    }
    lastWasFocused.current = isFocused;
  }, [isFocused, resetProgress, resetSequence]);

  const onLogout = useCallback(async () => {
    setLoggingOut(true);
    await db.nodeStoppedWhileLoggedIn.setValue(false);
    await handleLogout();
    // Important! Always close the sheet before navigating
    setPermSheetOpen(false);
    setTimeout(() => {
      navigation.navigate('Welcome');
    }, 200);
  }, [handleLogout, navigation]);

  useEffect(() => {
    if (notifPerms.hasPermission) {
      if (hostedNodeId) {
        scheduleNodeResumeNudge(hostedNodeId).catch((err) => {
          console.error('Error scheduling node resume nudge', err);
        });
      }
      setPermSheetOpen(false);
    }
  }, [hostedNodeId, notifPerms.hasPermission]);

  const insets = useSafeAreaInsets();

  return (
    <AppDataContextProvider>
      <View flex={1} backgroundColor="$secondaryBackground">
        <ScreenHeader
          rightControls={
            <ScreenHeader.TextButton
              onPress={onLogout}
              disabled={loggingOut}
              color="$tertiaryText"
            >
              Log out
            </ScreenHeader.TextButton>
          }
          showSessionStatus={false}
        />
        <YStack
          flex={1}
          paddingBottom={insets.bottom}
          justifyContent="space-between"
        >
          <ProgressBar progress={progress} />

          <YStack marginHorizontal="$xl">
            <OnboardingTextBlock marginTop="$3xl" gap="$5xl">
              <ArvosDiscussing width="100%" height={200} />
            </OnboardingTextBlock>
            <OnboardingTextBlock>
              <TlonText.Text textAlign="center" size="$label/l">
                Your P2P node is waking up after a deep sleep. This usually
                takes{' '}
                {params.waitType === 'Paused'
                  ? 'just a minute'
                  : 'a few minutes'}
                .
              </TlonText.Text>
            </OnboardingTextBlock>
          </YStack>

          <YStack marginHorizontal="$3xl" gap="$3xl" paddingBottom="$l">
            <ListItem backgroundColor="$background">
              <ListItem.SystemIcon
                icon={BOTTOM_WIDGET_ICONS[progress]}
                backgroundColor="unset"
                color="$primaryText"
              />
              <ListItem.MainContent>
                <ListItem.Title>
                  {BOTTOM_WIDGET_TITLES[progress]}
                </ListItem.Title>
              </ListItem.MainContent>
              <ListItem.EndContent width="$3xl" alignItems="center">
                {progress === 3 ? (
                  <ListItem.SystemIcon
                    icon="Checkmark"
                    backgroundColor="unset"
                    color="$secondaryText"
                  />
                ) : (
                  <LoadingSpinner size="small" />
                )}
              </ListItem.EndContent>
            </ListItem>
            <TlonText.Text
              size="$label/s"
              color="$secondaryText"
              textAlign="center"
            >
              Feel free to close the app if this takes too long. We’ll send you
              a notification when your node is ready.
            </TlonText.Text>
          </YStack>
          <StoppedNodePushSheet
            notifPerms={notifPerms}
            open={permSheetOpen}
            onOpenChange={() => setPermSheetOpen(false)}
            currentUserId={hostedNodeId || '~zod'}
          />
        </YStack>
      </View>
    </AppDataContextProvider>
  );
}

function ProgressBar(props: { progress: number; onPressLogout?: () => void }) {
  const isDark = useIsDarkMode();
  const PROGRESS_BAR_TITLES = useMemo(
    () => ['Warming up...', 'Getting ready...', 'Almost done...', 'Complete'],
    []
  );
  return (
    <YStack marginTop="$s" gap="$xl" marginHorizontal="$xl">
      <XStack justifyContent="space-between" width="100%">
        <TlonText.Text size="$label/l" fontWeight="500">
          Step {props.progress + 1} of 4
        </TlonText.Text>
      </XStack>
      <XStack width="100%" gap="$s">
        {PROGRESS_BAR_TITLES.map((step, i) => (
          <View
            key={i}
            backgroundColor={
              i <= props.progress
                ? '$primaryText'
                : isDark
                  ? '$activeBorder'
                  : '$border'
            }
            height={4}
            flex={1}
            borderRadius="$3xl"
          />
        ))}
      </XStack>
    </YStack>
  );
}

export const useStagedProgress = (
  initialProgress = 0,
  fakedProgressSpeed: 'slow' | 'fast' = 'slow'
) => {
  const [progress, setProgress] = useState(initialProgress);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Function to clear existing timeouts
  const clearExistingTimeouts = useCallback(() => {
    timeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    timeoutsRef.current = [];
  }, []);

  // Function to set up new timeouts
  const setupTimeouts = useCallback(() => {
    const stages =
      fakedProgressSpeed === 'slow'
        ? [
            { time: 60000, progress: 1 }, // 1 minute
            { time: 180000, progress: 2 }, // 3 minutes
          ]
        : [
            { time: 30000, progress: 1 }, // 30 seconds
            { time: 60000, progress: 2 }, // 1 minute
          ];

    const newTimeouts = stages.map((stage) => {
      return setTimeout(() => {
        setProgress((currentProgress) =>
          // Only update if the staged progress is higher than current
          stage.progress > currentProgress ? stage.progress : currentProgress
        );
      }, stage.time);
    });

    timeoutsRef.current = newTimeouts;
  }, [fakedProgressSpeed]);

  // Function to reset everything
  const resetProgress = useCallback(() => {
    clearExistingTimeouts();
    setProgress(initialProgress);
    setupTimeouts();
  }, [clearExistingTimeouts, setupTimeouts, initialProgress]);

  // Initial setup
  useEffect(() => {
    setupTimeouts();

    return () => {
      clearExistingTimeouts();
    };
  }, [setupTimeouts, clearExistingTimeouts]);

  // Manual progress update function that also manages timeouts
  const updateProgress = useCallback(
    (newProgress: number) => {
      setProgress(newProgress);
      if (newProgress >= 3) {
        clearExistingTimeouts();
      }
    },
    [clearExistingTimeouts]
  );

  return { progress, updateProgress, resetProgress };
};
