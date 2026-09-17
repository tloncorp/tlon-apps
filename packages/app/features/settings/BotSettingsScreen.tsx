import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
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

  // Bot settings require a live hosting session: prompt for re-auth when the
  // stored session is expired, and bail out when credentials are missing
  // entirely (nothing here can load without them).
  useEffect(() => {
    let cancelled = false;
    async function checkHostingSession() {
      const [isExpired, authToken, hostingUserId] = await Promise.all([
        db.hostingAuthExpired.getValue(),
        db.hostingAuthToken.getValue(),
        db.hostingUserId.getValue(),
      ]);
      if (cancelled) {
        return;
      }
      if (isExpired) {
        Alert.alert(
          'Logout Required',
          "To access bot settings, you'll need to log back in again.",
          [
            {
              text: 'Cancel',
              onPress: () => props.navigation.goBack(),
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
      if (!authToken || !hostingUserId) {
        logger.trackError('Bot settings opened without hosting session', {
          hasAuthToken: Boolean(authToken),
          hasHostingUserId: Boolean(hostingUserId),
        });
        Alert.alert('Error', 'Cannot access bot settings.', [
          { text: 'OK', onPress: () => props.navigation.goBack() },
        ]);
      }
    }
    checkHostingSession().catch((error) => {
      logger.trackError('Failed to check hosting session', { error });
    });
    return () => {
      cancelled = true;
    };
  }, [handleLogout, props.navigation]);

  const handleBack = useCallback(() => {
    props.navigation.goBack();
  }, [props.navigation]);

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
            navigate={
              props.navigation.navigate as unknown as BotSettingsNavigate
            }
            zdrRowLayout={props.zdrRowLayout}
          />
        </View>
      </SettingsContentScrollView>
      <BotSettingsApplyBar hub={hub} />
    </View>
  );
}
