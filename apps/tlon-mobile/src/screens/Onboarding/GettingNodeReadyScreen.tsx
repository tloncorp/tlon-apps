import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useShip } from '@tloncorp/app/contexts/ship';
import { useHandleLogout } from '@tloncorp/app/hooks/useHandleLogout';
import { useResetDb } from '@tloncorp/app/hooks/useResetDb';
import { AnalyticsEvent, createDevLogger, withRetry } from '@tloncorp/shared';
import { HostedNodeStatus } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import {
  ArvosDiscussing,
  OnboardingTextBlock,
  ScreenHeader,
  View,
  useStore,
} from '@tloncorp/ui';
import { useCallback, useEffect, useState } from 'react';

import { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<
  OnboardingStackParamList,
  'GettingNodeReadyScreen'
>;

const logger = createDevLogger('GettingNodeReadyScreen', true);
const RE_CHECK_INTERVAL = 10 * 1000;

export function GettingNodeReadyScreen({
  navigation,
  route: { params },
}: Props) {
  const isFocused = useIsFocused();
  const store = useStore();
  const { setShip } = useShip();
  const resetDb = useResetDb();
  const handleLogout = useHandleLogout({ resetDb });
  const [loggingOut, setLoggingOut] = useState(false);

  const isNodeRunning = useCallback(async () => {
    const nodeId = await db.hostedUserNodeId.getValue();
    if (!nodeId) {
      logger.trackError('Login: Missing node ID while checking if running');
      return false;
    }

    try {
      const status = await store.checkHostingNodeStatus();
      if (status === HostedNodeStatus.UnderMaintenance) {
        navigation.navigate('UnderMaintenance');
      }
      return status === HostedNodeStatus.Running;
    } catch (e) {
      logger.trackError('Login: Check node booted request failed', {
        nodeId,
        errorMessage: e.message,
        errorStack: e.stack,
      });
      return false;
    }
  }, [navigation, store]);

  const onLogout = useCallback(async () => {
    setLoggingOut(true);
    await handleLogout();
    navigation.navigate('Welcome');
  }, [handleLogout, navigation]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    let isMounted = true;
    const startTime = Date.now();

    async function checkNode() {
      const isRunning = await isNodeRunning();
      if (!isMounted || !isFocused) return;
      if (isRunning) {
        db.hostedNodeIsRunning.setValue(true);
        const bootedAtTime = Date.now();
        await withRetry(
          async () => {
            const shipInfo = await store.authenticateWithReadyNode();
            if (!shipInfo) {
              throw new Error('Failed to authenticate with node');
            }
            setShip(shipInfo);
          },
          { numOfAttempts: 20 }
        );
        const authedAtTime = Date.now();
        logger.trackEvent(AnalyticsEvent.NodeWaitReport, {
          intialNodeState: params.waitType ?? 'unknown',
          appLifecyle: 'login',
          timeToBoot: Math.floor((bootedAtTime - startTime) / 1000),
          timeToAuth: Math.floor((authedAtTime - bootedAtTime) / 1000),
          totalWaitTime: Math.floor((authedAtTime - startTime) / 1000),
          unit: 'seconds',
        });
      } else {
        timeoutId = setTimeout(checkNode, RE_CHECK_INTERVAL);
      }
    }

    if (isFocused) {
      checkNode();
    }

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        title={
          params.wasLoggedIn
            ? 'Computer not Running'
            : 'Getting Your Peer-to-peer Node Ready'
        }
        backAction={!params.wasLoggedIn ? () => navigation.goBack() : undefined}
        leftControls={
          params.wasLoggedIn ? (
            <ScreenHeader.TextButton onPress={onLogout} disabled={loggingOut}>
              Log out
            </ScreenHeader.TextButton>
          ) : undefined
        }
        showSessionStatus={false}
      />
      <OnboardingTextBlock marginTop="$5xl" gap="$5xl">
        <ArvosDiscussing width="100%" height={200} />
      </OnboardingTextBlock>
    </View>
  );
}
