import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createDevLogger } from '@tloncorp/shared';
import { useCallback, useEffect } from 'react';
import { Alert } from 'react-native';

import { useHandleLogout } from '../../hooks/useHandleLogout';
import { useResetDb } from '../../hooks/useResetDb';
import { RootStackParamList } from '../../navigation/types';
import { SettingsListScreenView } from '../../ui/components/SettingsList';
import {
  BotSettingsApplyBar,
  BotSettingsNavigate,
  useBotSettingsHub,
  useBotSettingsSectionModels,
} from './bot/BotSettingsSections';
import { useHostingSession } from './bot/useHostingSession';

type Props = NativeStackScreenProps<RootStackParamList, 'BotSettings'>;

const logger = createDevLogger('BotSettingsScreen', false);

/**
 * The bot settings hub as reached from the bot's own profile. The Settings tab
 * renders the same sections inline, so both surfaces stay in step.
 */
export function BotSettingsScreen(props: Props) {
  const resetDb = useResetDb();
  const handleLogout = useHandleLogout({ resetDb });
  const hub = useBotSettingsHub();
  const hostingSession = useHostingSession();
  const { navigation } = props;

  // Bot settings require a live hosting session. This screen can be reached
  // directly (profile link, deep link), so prompt for re-auth when the stored
  // session is stale and bail out when credentials are missing entirely.
  useEffect(() => {
    if (hostingSession === 'expired') {
      Alert.alert(
        'Logout Required',
        "To access bot settings, you'll need to log back in again.",
        [
          {
            text: 'Cancel',
            onPress: () => navigation.goBack(),
            style: 'cancel',
          },
          {
            text: 'Logout',
            onPress: handleLogout,
          },
        ]
      );
      return;
    }
    if (hostingSession === 'missing') {
      logger.trackError('Bot settings opened without hosting session');
      Alert.alert('Error', 'Cannot access bot settings.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
  }, [handleLogout, hostingSession, navigation]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const { overview } = useBotSettingsSectionModels(
    hub,
    navigation.navigate as unknown as BotSettingsNavigate
  );

  return (
    <SettingsListScreenView
      title="Bot settings"
      sections={overview}
      onBackPressed={handleBack}
      bottomBar={<BotSettingsApplyBar hub={hub} />}
    />
  );
}
