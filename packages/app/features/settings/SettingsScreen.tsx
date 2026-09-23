import { getCurrentUserIsHosted } from '@tloncorp/api';
import { useMutableRef } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { triggerHaptic } from '@tloncorp/ui';
import { ComponentProps, useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { getVariableValue, useTheme } from 'tamagui';

import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { useHandleLogout } from '../../hooks/useHandleLogout';
import { useResetDb } from '../../hooks/useResetDb';
import { useNavigation } from '../../navigation/utils';
import { SettingsScreenView, View, openTlonWebApp } from '../../ui';
import ProfileStatusSheet from '../../ui/components/ProfileStatusSheet';
import {
  openExternalBotSettings,
  useHasExpectedBotDm,
} from '../../utils/botSettings';
import {
  BotSettingsApplyBar,
  BotSettingsNavigate,
  BotSettingsSections,
  useBotSettingsHub,
} from './bot/BotSettingsSections';
import { useHostingSession } from './bot/useHostingSession';
import { useSettingsRowLabels } from './useSettingsRowLabels';

export default function SettingsScreen() {
  const resetDb = useResetDb();
  const handleLogout = useHandleLogout({ resetDb });
  const currentUserId = useCurrentUserId();
  const hasHostedAuth = useHasHostedAuth();
  const hostingBotEnabled = db.hostingBotEnabled.useValue();
  const isHostedUser = getCurrentUserIsHosted();
  const hostingSession = useHostingSession();
  const hasExpectedBotDm = useHasExpectedBotDm(
    currentUserId,
    Platform.OS === 'web' && isHostedUser
  );
  const botEnabled =
    Platform.OS === 'web'
      ? isHostedUser && hasExpectedBotDm
      : isHostedUser && hostingBotEnabled;
  // Web has no inline bot settings — its row opens the hosted page instead. And
  // the bot queries retry on an interval until they succeed, so mounting them
  // without a usable hosting session would poll forever rather than surface
  // anything; the standalone screen can prompt for re-auth, a tab root cannot.
  const showsInlineBotSettings =
    botEnabled && Platform.OS !== 'web' && hostingSession === 'valid';

  const navigationRef = useMutableRef(useNavigation());
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const { themeLabel, notificationsLabel } = useSettingsRowLabels();

  const onAppInfoPressed = useCallback(() => {
    navigationRef.current.navigate('AppInfo');
  }, [navigationRef]);

  const onPushNotifPressed = useCallback(() => {
    navigationRef.current.navigate('PushNotificationSettings');
  }, [navigationRef]);

  const onBlockedUsersPressed = useCallback(() => {
    navigationRef.current.navigate('BlockedUsers');
  }, [navigationRef]);

  const onManageAccountPressed = useCallback(() => {
    navigationRef.current.navigate('ManageAccount');
  }, [navigationRef]);

  const onBotSettingsPressed = useCallback(() => {
    if (Platform.OS === 'web') {
      openExternalBotSettings();
      return;
    }
    navigationRef.current.navigate('BotSettings');
  }, [navigationRef]);

  const onExperimentalFeaturesPressed = useCallback(() => {
    navigationRef.current.navigate('FeatureFlags');
  }, [navigationRef]);

  const onSendBugReportPressed = useCallback(() => {
    navigationRef.current.navigate('WompWomp');
  }, [navigationRef]);

  const onThemePressed = useCallback(() => {
    navigationRef.current.navigate('Theme');
  }, [navigationRef]);

  const onPrivacyPressed = useCallback(() => {
    navigationRef.current.navigate('PrivacySettings');
  }, [navigationRef]);

  const onProfilePressed = useCallback(() => {
    navigationRef.current.navigate('UserProfile', { userId: currentUserId });
  }, [currentUserId, navigationRef]);

  const onProfileLongPressed = useCallback(() => {
    triggerHaptic('sheetOpen');
    setStatusSheetOpen(true);
  }, []);

  const onContactsPressed = useCallback(() => {
    navigationRef.current.navigate('Contacts', undefined, { pop: true });
  }, [navigationRef]);

  const onUpdateStatus = useCallback((status: string) => {
    store.updateCurrentUserProfile({ status });
    setStatusSheetOpen(false);
  }, []);

  const backgroundColor = getVariableValue(useTheme().background);

  const viewProps: ComponentProps<typeof SettingsScreenView> = {
    hasHostedAuth,
    currentUserId,
    onLogoutPressed: handleLogout,
    onSendBugReportPressed,
    onAppInfoPressed,
    onNotificationSettingsPressed: onPushNotifPressed,
    onBlockedUsersPressed,
    onManageAccountPressed,
    onBotSettingsPressed,
    onExperimentalFeaturesPressed,
    onThemePressed,
    onPrivacyPressed,
    onProfilePressed,
    onProfileLongPressed,
    onContactsPressed,
    onWebAppPressed: isHostedUser ? openTlonWebApp : undefined,
    botEnabled,
    themeLabel,
    notificationsLabel,
  };

  return (
    <View backgroundColor={backgroundColor} flex={1}>
      {showsInlineBotSettings ? (
        <SettingsViewWithBot viewProps={viewProps} />
      ) : (
        <SettingsScreenView {...viewProps} />
      )}
      {statusSheetOpen && (
        <ProfileStatusSheet
          open
          onOpenChange={() => setStatusSheetOpen(false)}
          onUpdateStatus={onUpdateStatus}
        />
      )}
    </View>
  );
}

/**
 * Mounts the bot queries and draft once, and hands the view its sections plus
 * the apply bar that commits them. Separate from the screen above so that the
 * bot flag resolving swaps only the view, not the screen's own state.
 */
function SettingsViewWithBot({
  viewProps,
}: {
  viewProps: ComponentProps<typeof SettingsScreenView>;
}) {
  const hub = useBotSettingsHub();
  const navigationRef = useMutableRef(useNavigation());
  const navigate = useCallback(
    (screen: Parameters<BotSettingsNavigate>[0], params?: object) => {
      (
        navigationRef.current.navigate as unknown as (
          name: string,
          params?: object
        ) => void
      )(screen, params);
    },
    [navigationRef]
  );

  return (
    <SettingsScreenView
      {...viewProps}
      botSections={<BotSettingsSections hub={hub} navigate={navigate} />}
      bottomBar={<BotSettingsApplyBar hub={hub} />}
    />
  );
}

function useHasHostedAuth() {
  const [hasHostedAuth, setHasHostedAuth] = useState(false);

  useEffect(() => {
    async function getHostingInfo() {
      const [cookie, userId] = await Promise.all([
        db.hostingAuthToken.getValue(),
        db.hostingUserId.getValue(),
      ]);
      if (cookie && userId) {
        setHasHostedAuth(true);
      }
    }
    if (Platform.OS !== 'web') {
      getHostingInfo();
    }
  }, []);

  return hasHostedAuth;
}
