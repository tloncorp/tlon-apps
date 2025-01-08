import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useShip } from '@tloncorp/app/contexts/ship';
import BootHelpers from '@tloncorp/app/lib/bootHelpers';
import { getShipFromCookie } from '@tloncorp/app/utils/ship';
import { AnalyticsEvent, createDevLogger, withRetry } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import {
  ArvosDiscussing,
  OnboardingTextBlock,
  ScreenHeader,
  View,
} from '@tloncorp/ui';
import { useEffect } from 'react';

import { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<
  OnboardingStackParamList,
  'GettingNodeReadyScreen'
>;

const logger = createDevLogger('GettingNodeReadyScreen', true);

export function GettingNodeReadyScreen({
  navigation,
  route: { params },
}: Props) {
  const isFocused = useIsFocused();
  const { setShip } = useShip();

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
            const nodeId = await db.hostedUserNodeId.getValue();
            const auth = await BootHelpers.authenticateNode(nodeId!);
            const ship = getShipFromCookie(auth.authCookie);
            setShip({
              ship,
              shipUrl: auth.nodeUrl,
              authCookie: auth.authCookie,
              authType: 'hosted',
            });
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
        timeoutId = setTimeout(checkNode, 3000);
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
        title="Getting Your Peer-to-peer Node Ready"
        backAction={() => navigation.goBack()}
      />
      <OnboardingTextBlock marginTop="$5xl" gap="$5xl">
        <ArvosDiscussing width="100%" height={200} />
      </OnboardingTextBlock>
    </View>
  );
}

async function isNodeRunning(): Promise<boolean> {
  const nodeId = await db.hostedUserNodeId.getValue();
  if (!nodeId) {
    logger.trackError('Login: Missing node ID while checking if running');
    return false;
  }

  try {
    const isBooted = await BootHelpers.checkNodeBooted(nodeId);
    logger.log(`checked node booted`, { nodeId, isBooted });
    return isBooted;
  } catch (e) {
    logger.trackError('Login: Check node booted request failed', {
      nodeId,
      errorMessage: e.message,
      errorStack: e.stack,
    });
    return false;
  }
}
