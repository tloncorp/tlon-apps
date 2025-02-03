import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useShip } from '@tloncorp/app/contexts/ship';
import { useHandleLogout } from '@tloncorp/app/hooks/useHandleLogout';
import { useResetDb } from '@tloncorp/app/hooks/useResetDb';
import {
  NodeResumeState,
  useStoppedNodeSequence,
} from '@tloncorp/app/hooks/useStoppedNodeSequence';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import {
  ArvosDiscussing,
  ListItem,
  LoadingSpinner,
  OnboardingTextBlock,
  ScreenHeader,
  TlonText,
  View,
  YStack,
} from '@tloncorp/ui';
import { useCallback, useEffect, useRef, useState } from 'react';

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
  const lastWasFocused = useRef(true);
  const { setShip } = useShip();
  const resetDb = useResetDb();
  const handleLogout = useHandleLogout({ resetDb });
  const [loggingOut, setLoggingOut] = useState(false);

  const { phase, shipInfo, resetSequence } = useStoppedNodeSequence({
    waitType: params.waitType,
    enabled: isFocused,
  });
  useEffect(() => {
    if (phase === NodeResumeState.UnderMaintenance) {
      navigation.navigate('UnderMaintenance');
    }

    if (phase === NodeResumeState.Ready && shipInfo) {
      setTimeout(() => {
        setShip(shipInfo);
      }, 1000);
    }
  }, [navigation, phase, setShip, shipInfo]);

  useEffect(() => {
    if (isFocused && !lastWasFocused.current) {
      // if we came back to this screen, make sure the sequence starts over
      resetSequence();
    }
    lastWasFocused.current = isFocused;
  }, [isFocused, resetSequence]);

  const onLogout = useCallback(async () => {
    setLoggingOut(true);
    await db.nodeStoppedWhileLoggedIn.setValue(false);
    await handleLogout();
    navigation.navigate('Welcome');
  }, [handleLogout, navigation]);

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        title={params.wasLoggedIn ? 'Node Stopped' : 'Starting Your Node'}
        leftControls={
          <ScreenHeader.TextButton onPress={onLogout} disabled={loggingOut}>
            Log out
          </ScreenHeader.TextButton>
        }
        showSessionStatus={false}
      />
      <OnboardingTextBlock marginTop="$3xl" gap="$5xl">
        <ArvosDiscussing width="100%" height={200} />
      </OnboardingTextBlock>
      <OnboardingTextBlock>
        <TlonText.Text textAlign="center" size="$label/l">
          Your Peer-to-peer Node hadn't been used in a while and we need to
          start it up again. This usually takes{' '}
          {params.waitType === 'Paused' ? 'just a minute' : 'a few minutes'}.
        </TlonText.Text>
      </OnboardingTextBlock>

      <YStack padding="$m" marginTop="$3xl">
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
      </YStack>
    </View>
  );
}
