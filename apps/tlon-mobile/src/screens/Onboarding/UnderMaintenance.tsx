import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useHandleLogout } from '@tloncorp/app/hooks/useHandleLogout';
import { useResetDb } from '@tloncorp/app/hooks/useResetDb';
import {
  ScreenHeader,
  SplashParagraph,
  SplashTitle,
  TlonText,
  View,
  YStack,
  useStore,
} from '@tloncorp/app/ui';
import { createDevLogger } from '@tloncorp/shared';
import { HostedNodeStatus } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import { Button, Text } from '@tloncorp/ui';
import { useCallback, useState } from 'react';
import { openComposer } from 'react-native-email-link';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<
  OnboardingStackParamList,
  'UnderMaintenance'
>;

const logger = createDevLogger('UnderMaintenanceScreen', true);

export function UnderMaintenanceScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const store = useStore();
  const resetDb = useResetDb();
  const handleLogout = useHandleLogout({ resetDb });
  const [loggingOut, setLoggingOut] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  const handleRecheckStatus = useCallback(async () => {
    setRechecking(true);
    try {
      const { status: nodeStatus } = await store.checkHostingNodeStatus();
      logger.trackEvent('User Rechecked Node Status', { nodeStatus });
      if (nodeStatus !== HostedNodeStatus.UnderMaintenance) {
        navigation.navigate('GettingNodeReadyScreen', { waitType: 'Unknown' });
      } else {
        setCheckedAt(new Date());
      }
    } finally {
      setRechecking(false);
    }
  }, [navigation, store]);

  const onLogout = useCallback(async () => {
    setLoggingOut(true);
    await db.nodeStoppedWhileLoggedIn.setValue(false);
    await handleLogout();
    navigation.navigate('Welcome');
  }, [handleLogout, navigation]);

  const handleEmailSupport = useCallback(() => {
    openComposer({
      to: 'support@tlon.io',
      subject: 'Help! My node needs repair.',
    });
  }, []);

  return (
    <View
      flex={1}
      backgroundColor="$background"
      paddingTop={insets.top}
      paddingBottom={insets.bottom}
    >
      <YStack
        paddingHorizontal="$xl"
        paddingTop="$s"
        alignItems="flex-start"
      >
        <ScreenHeader.TextButton
          onPress={onLogout}
          disabled={loggingOut}
          color="$tertiaryText"
        >
          Log out
        </ScreenHeader.TextButton>
      </YStack>
      <YStack flex={1} gap="$2xl" paddingTop="$2xl">
        <SplashTitle>
          Your node needs <Text color="$positiveActionText">repair.</Text>
        </SplashTitle>
        <SplashParagraph marginBottom={0}>
          Your peer-to-peer node needs to undergo maintenance and cannot be
          started. Our support team has been alerted.
        </SplashParagraph>
        {checkedAt && (
          <SplashParagraph marginBottom={0}>
            <TlonText.RawText color="$secondaryText">
              Last checked at {logic.makePrettyTime(checkedAt)}
            </TlonText.RawText>
          </SplashParagraph>
        )}
      </YStack>
      <YStack paddingHorizontal="$xl" gap="$l" marginTop="$xl">
        <Button
          loading={rechecking}
          disabled={rechecking}
          onPress={handleRecheckStatus}
          label={rechecking ? 'Checking…' : 'Check again'}
          preset="hero"
          shadow={!rechecking}
        />
        {checkedAt && (
          <Button
            onPress={handleEmailSupport}
            label="Email support"
            preset="secondary"
            backgroundColor="transparent"
          />
        )}
      </YStack>
    </View>
  );
}
