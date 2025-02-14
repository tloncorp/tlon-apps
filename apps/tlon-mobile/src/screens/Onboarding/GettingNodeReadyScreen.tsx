// tamagui-ignore
import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useShip } from '@tloncorp/app/contexts/ship';
import { useHandleLogout } from '@tloncorp/app/hooks/useHandleLogout';
import { useResetDb } from '@tloncorp/app/hooks/useResetDb';
import {
  NodeResumeState,
  useStoppedNodeSequence,
} from '@tloncorp/app/hooks/useStoppedNodeSequence';
import {
  scheduleNodeResumeNudge,
  useNotificationPermissions,
} from '@tloncorp/app/lib/notifications';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import {
  AppDataContextProvider,
  ArvosDiscussing,
  ListItem,
  LoadingSpinner,
  OnboardingTextBlock,
  StoppedNodePushSheet,
  TlonText,
  View,
  XStack,
  YStack,
} from '@tloncorp/ui';
import { Text } from '@tloncorp/ui/src/components/TextV2';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnboardingStackParamList } from '../../types';

const BOTTOM_WIDGET_TITLES = [
  'Pulling out of storage',
  'Running boot sequence',
  'Establishing a connection',
  'Your node is ready',
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
  // const [progress, setProgress] = useState(0);
  const isFocused = useIsFocused();
  const lastWasFocused = useRef(true);
  const { setShip } = useShip();
  const resetDb = useResetDb();
  const handleLogout = useHandleLogout({ resetDb });
  const [loggingOut, setLoggingOut] = useState(false);
  const { progress, updateProgress, resetProgress } = useStagedProgress(
    0,
    params.waitType === 'Paused' ? 'fast' : 'slow'
  );
  const notifPerms = useNotificationPermissions();
  const [permSheetOpen, setPermSheetOpen] = useState(true);
  const hostedNodeId = db.hostedUserNodeId.useValue();
  const { phase, shipInfo, resetSequence } = useStoppedNodeSequence({
    waitType: params.waitType,
    enabled: isFocused,
  });

  const lastUpdatedPhase = useRef<null | NodeResumeState>(null);
  useEffect(() => {
    if (lastUpdatedPhase.current !== phase) {
      console.log('bl: effect running', phase);
      lastUpdatedPhase.current = phase;
      if (phase === NodeResumeState.UnderMaintenance) {
        navigation.navigate('UnderMaintenance');
      }

      if (phase === NodeResumeState.Authenticating) {
        updateProgress(2);
      }

      if (phase === NodeResumeState.Ready && shipInfo) {
        updateProgress(3);
        setPermSheetOpen(false);
        setTimeout(() => {
          setShip(shipInfo);
        }, 2000);
      }
    }
  }, [navigation, phase, setShip, shipInfo, updateProgress]);

  useEffect(() => {
    if (isFocused && !lastWasFocused.current) {
      // if we came back to this screen, make sure the sequence starts over
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
    navigation.navigate('Welcome');
  }, [handleLogout, navigation]);

  // const hostedUserNodeId = db.hostedUserNodeId.useValue();
  // useEffect(() => {
  //   if (hostedUserNodeId) {
  //     scheduleNodeResumeNudge(hostedUserNodeId).catch((err) => {
  //       console.error('Error scheduling node resume nudge', err);
  //     });
  //   }
  // }, [hostedUserNodeId]);

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
      <YStack
        flex={1}
        backgroundColor="$secondaryBackground"
        paddingTop={insets.top}
        paddingBottom={insets.bottom}
        justifyContent="space-between"
      >
        {/* <ScreenHeader
          // title={params.wasLoggedIn ? 'Node Stopped' : 'Starting Your Node'}
          leftControls={
            <ScreenHeader.TextButton
              onPress={onLogout}
              disabled={loggingOut}
              color="$secondaryText"
            >
              Log out
            </ScreenHeader.TextButton>
          }
          showSessionStatus={false}
        /> */}
        <ProgressBar progress={progress} />

        <YStack marginHorizontal="$xl">
          <OnboardingTextBlock marginTop="$3xl" gap="$5xl">
            <ArvosDiscussing width="100%" height={200} />
          </OnboardingTextBlock>
          <OnboardingTextBlock>
            <TlonText.Text textAlign="center" size="$label/l">
              Your P2P node is waking up after a deep sleep. This usually takes{' '}
              {params.waitType === 'Paused' ? 'just a minute' : 'a few minutes'}
              .
            </TlonText.Text>
          </OnboardingTextBlock>
        </YStack>

        <YStack marginHorizontal="$3xl" gap="$3xl" paddingBottom="$l">
          <ListItem backgroundColor="$background">
            <ListItem.SystemIcon
              icon="ChannelGalleries"
              backgroundColor="unset"
              color="$primaryText"
            />
            <ListItem.MainContent>
              <ListItem.Title>{BOTTOM_WIDGET_TITLES[progress]}</ListItem.Title>
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
          <Text size="$label/s" color="$secondaryText" textAlign="center">
            Feel free to close TM if this takes too long. We’ll send you a
            notification when your urbit is ready.
          </Text>
        </YStack>

        {/* <YStack padding="$m" marginTop="$3xl">
          <ListItem backgroundColor="unset">
            <ListItem.SystemIcon color="$primaryText" icon="Bang" />
            <ListItem.MainContent>
              <ListItem.Title>Waiting for node to start</ListItem.Title>
            </ListItem.MainContent>
            <ListItem.EndContent width="$3xl" alignItems="center">
              {phase === NodeResumeState.WaitingForRunning && (
                <LoadingSpinner size="small" />
              )}
              {phase !== NodeResumeState.WaitingForRunning && (
                <ListItem.SystemIcon icon="Checkmark" />
              )}
            </ListItem.EndContent>
          </ListItem>
          <ListItem backgroundColor="unset">
            <ListItem.SystemIcon color="$primaryText" icon="Link" />
            <ListItem.MainContent>
              <ListItem.Title>Establishing a connection</ListItem.Title>
            </ListItem.MainContent>
            <ListItem.EndContent width="$3xl" alignItems="center">
              {phase === NodeResumeState.Authenticating && (
                <LoadingSpinner size="small" />
              )}
              {phase === NodeResumeState.Ready && (
                <ListItem.SystemIcon icon="Checkmark" />
              )}
            </ListItem.EndContent>
          </ListItem>
        </YStack> */}
        <StoppedNodePushSheet
          notifPerms={notifPerms}
          open={permSheetOpen}
          onOpenChange={() => setPermSheetOpen(false)}
          currentUserId={hostedNodeId || '~zod'}
        />
      </YStack>
    </AppDataContextProvider>
  );
}

function ProgressBar(props: { progress: number; onPressLogout?: () => void }) {
  const PROGRESS_BAR_TITLES = useMemo(
    () => ['Warming up...', 'Getting ready...', 'Almost done...', 'Complete'],
    []
  );
  return (
    <YStack marginTop="$xl" gap="$xl" marginHorizontal="$xl">
      <XStack justifyContent="space-between" width="100%">
        <Text size="$label/l" fontWeight="500">
          {PROGRESS_BAR_TITLES[props.progress]}
        </Text>
        {/* <Pressable onPress={props.onPressLogout}>
          <Text size="$label/l" fontWeight="500" color="$secondaryText">
            Logout
          </Text>
        </Pressable> */}
      </XStack>
      <XStack width="100%" gap="$s">
        {PROGRESS_BAR_TITLES.map((step, i) => (
          <View
            key={i}
            backgroundColor={i <= props.progress ? '$primaryText' : '$border'}
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
        console.log(`timeout running for progress ${stage.time}`);
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
    console.log('scaffold running');
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
