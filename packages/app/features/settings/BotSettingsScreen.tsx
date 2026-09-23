import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createDevLogger } from '@tloncorp/shared';
import { useIsWindowNarrow } from '@tloncorp/ui';
import { useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { View } from 'tamagui';

import { useHandleLogout } from '../../hooks/useHandleLogout';
import { useResetDb } from '../../hooks/useResetDb';
import { RootStackParamList } from '../../navigation/types';
import { ScreenHeader, SettingsContentScrollView } from '../../ui';
import {
  BotSettingsApplyBar,
  BotSettingsNavigate,
  BotSettingsSections,
  useBotSettingsHub,
} from './bot/BotSettingsSections';
import { useHostingSession } from './bot/useHostingSession';

type Props = NativeStackScreenProps<RootStackParamList, 'BotSettings'> & {
  zdrRowLayout?: {
    descriptionGap?: number;
    paddingVertical?: number;
  };
};

const logger = createDevLogger('BotSettingsScreen', false);

/**
 * The bot settings hub as reached from the bot's own profile. The Settings tab
 * renders the same sections inline, so both surfaces stay in step.
 */
export function BotSettingsScreen(props: Props) {
  const isWindowNarrow = useIsWindowNarrow();
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

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        borderBottom
        backAction={isWindowNarrow ? handleBack : undefined}
        title="Bot settings"
        placement="navigation"
      />
      <SettingsContentScrollView
        paddingHorizontal="$l"
        paddingTop="$l"
        safeAreaBottomOffset={24}
      >
        <View paddingBottom="$2xl">
          <BotSettingsSections
            hub={hub}
            navigate={navigation.navigate as unknown as BotSettingsNavigate}
            zdrRowLayout={props.zdrRowLayout}
          />
        </View>
      </SettingsContentScrollView>
      <BotSettingsApplyBar hub={hub} />
    </View>
  );
}
