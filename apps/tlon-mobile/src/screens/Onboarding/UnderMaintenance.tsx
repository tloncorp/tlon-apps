import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useHandleLogout } from '@tloncorp/app/hooks/useHandleLogout';
import { useResetDb } from '@tloncorp/app/hooks/useResetDb';
import {
  OnboardingTextBlock,
  PrimaryButton,
  ScreenHeader,
  View,
  useStore,
} from '@tloncorp/app/ui';
import { TlonText } from '@tloncorp/app/ui';
import { createDevLogger } from '@tloncorp/shared';
import { HostedNodeStatus } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import { useCallback, useState } from 'react';

import { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<
  OnboardingStackParamList,
  'UnderMaintenance'
>;

const logger = createDevLogger('UnderMaintenanceScreen', true);

export function UnderMaintenanceScreen({ navigation }: Props) {
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

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        title="Needs Repair"
        leftControls={
          <ScreenHeader.TextButton onPress={onLogout} disabled={loggingOut}>
            Log out
          </ScreenHeader.TextButton>
        }
        showSessionStatus={false}
      />
      <OnboardingTextBlock>
        <TlonText.Text size="$label/l">
          Your Peer-to-peer Node needs to undergo maintenance and cannot be
          started. Our support team has been alerted.
        </TlonText.Text>
        {checkedAt && (
          <TlonText.Text size="$label/l" color="$secondaryText">
            Last checked at {logic.makePrettyTime(checkedAt)}
          </TlonText.Text>
        )}
        <PrimaryButton loading={rechecking} onPress={handleRecheckStatus}>
          Check Again
        </PrimaryButton>
      </OnboardingTextBlock>
    </View>
  );
}
