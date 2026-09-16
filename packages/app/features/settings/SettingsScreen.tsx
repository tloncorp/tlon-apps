import { getCurrentUserIsHosted } from '@tloncorp/api';
import { useMutableRef } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { triggerHaptic } from '@tloncorp/ui';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { getVariableValue, useTheme } from 'tamagui';

import { useDMLureLink } from '../../hooks/useBranchLink';
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

export default function SettingsScreen() {
  const resetDb = useResetDb();
  const handleLogout = useHandleLogout({ resetDb });
  const currentUserId = useCurrentUserId();
  const { dmLink } = useDMLureLink();
  const hasHostedAuth = useHasHostedAuth();
  const hostingBotEnabled = db.hostingBotEnabled.useValue();
  const isHostedUser = getCurrentUserIsHosted();
  const hasExpectedBotDm = useHasExpectedBotDm(
    currentUserId,
    Platform.OS === 'web' && isHostedUser
  );
  const botEnabled =
    Platform.OS === 'web'
      ? isHostedUser && hasExpectedBotDm
      : isHostedUser && hostingBotEnabled;
  const navigationRef = useMutableRef(useNavigation());
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);

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

  return (
    <View backgroundColor={backgroundColor} flex={1}>
      <SettingsScreenView
        hasHostedAuth={hasHostedAuth}
        currentUserId={currentUserId}
        onLogoutPressed={handleLogout}
        onSendBugReportPressed={onSendBugReportPressed}
        onAppInfoPressed={onAppInfoPressed}
        onNotificationSettingsPressed={onPushNotifPressed}
        onBlockedUsersPressed={onBlockedUsersPressed}
        onManageAccountPressed={onManageAccountPressed}
        onBotSettingsPressed={onBotSettingsPressed}
        onExperimentalFeaturesPressed={onExperimentalFeaturesPressed}
        onThemePressed={onThemePressed}
        onPrivacyPressed={onPrivacyPressed}
        onProfilePressed={onProfilePressed}
        onProfileLongPressed={onProfileLongPressed}
        onContactsPressed={onContactsPressed}
        onWebAppPressed={isHostedUser ? openTlonWebApp : undefined}
        dmLink={dmLink}
        botEnabled={botEnabled}
      />
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
