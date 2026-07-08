import {
  DrawerContentComponentProps,
  createDrawerNavigator,
} from '@react-navigation/drawer';
import { getVariableValue, useTheme } from '@tamagui/core';
import { getCurrentUserIsHosted } from '@tloncorp/api';
import * as db from '@tloncorp/shared/db';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { AppInfoScreen } from '../../features/settings/AppInfoScreen';
import { BlockedUsersScreen } from '../../features/settings/BlockedUsersScreen';
import { BotMcpSettingsScreen } from '../../features/settings/BotMcpSettingsScreen';
import { BotOtherSettingsScreen } from '../../features/settings/BotOtherSettingsScreen';
import { BotSettingsScreen } from '../../features/settings/BotSettingsScreen';
import { FeatureFlagScreen } from '../../features/settings/FeatureFlagScreen';
import { ManageAccountScreen } from '../../features/settings/ManageAccountScreen';
import { PrivacySettingsScreen } from '../../features/settings/PrivacyScreen';
import { PushNotificationSettingsScreen } from '../../features/settings/PushNotificationSettingsScreen';
import { ThemeScreen } from '../../features/settings/ThemeScreen';
import { UserBugReportScreen } from '../../features/settings/UserBugReportScreen';
import { SettingsEmptyState } from '../../features/top/DesktopEmptyStates';
import { useDMLureLink } from '../../hooks/useBranchLink';
import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { useHandleLogout } from '../../hooks/useHandleLogout';
import { useResetDb } from '../../hooks/useResetDb';
import { DESKTOP_SIDEBAR_WIDTH, SettingsScreenView } from '../../ui';
import {
  openExternalBotSettings,
  useHasExpectedBotDm,
} from '../../utils/botSettings';

const SettingsDrawer = createDrawerNavigator();

function DrawerContent(props: DrawerContentComponentProps) {
  const { navigate } = props.navigation;
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
  const focusedRoute = props.state.routes[props.state.index];

  const onAppInfoPressed = useCallback(() => {
    navigate('AppInfo');
  }, [navigate]);

  const onPushNotifPressed = useCallback(() => {
    navigate('PushNotificationSettings');
  }, [navigate]);

  const onBlockedUsersPressed = useCallback(() => {
    navigate('BlockedUsers');
  }, [navigate]);

  const onManageAccountPressed = useCallback(() => {
    navigate('ManageAccount');
  }, [navigate]);

  const onBotSettingsPressed = useCallback(() => {
    if (Platform.OS === 'web') {
      openExternalBotSettings();
      return;
    }
    navigate('BotSettings');
  }, [navigate]);

  const onExperimentalFeaturesPressed = useCallback(() => {
    navigate('FeatureFlags');
  }, [navigate]);

  const onSendBugReportPressed = useCallback(() => {
    navigate('WompWomp');
  }, [navigate]);

  const onThemePressed = useCallback(() => {
    navigate('Theme');
  }, [navigate]);

  const onPrivacyPressed = useCallback(() => {
    navigate('PrivacySettings');
  }, [navigate]);

  return (
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
      dmLink={dmLink}
      focusedRouteName={focusedRoute.name}
      botEnabled={botEnabled}
    />
  );
}

export const SettingsNavigator = () => {
  return (
    <SettingsDrawer.Navigator
      initialRouteName="SettingsEmpty"
      drawerContent={DrawerContent}
      screenOptions={{
        headerShown: false,
        drawerType: 'permanent',
        drawerStyle: {
          width: DESKTOP_SIDEBAR_WIDTH,
          backgroundColor: getVariableValue(useTheme().background),
          borderRightColor: getVariableValue(useTheme().border),
        },
      }}
    >
      <SettingsDrawer.Screen
        name="SettingsEmpty"
        component={EmptySettingsScreen}
      />
      {/* @ts-expect-error react-navigation types are not yet TS7-compatible; remove once react-navigation/react-navigation#13163 ships */}
      <SettingsDrawer.Screen name="Theme" component={ThemeScreen} />
      {/* @ts-expect-error react-navigation types are not yet TS7-compatible; remove once react-navigation/react-navigation#13163 ships */}
      <SettingsDrawer.Screen name="AppInfo" component={AppInfoScreen} />
      <SettingsDrawer.Screen
        // @ts-expect-error react-navigation types are not yet TS7-compatible; remove once react-navigation/react-navigation#13163 ships
        name="PushNotificationSettings"
        // @ts-expect-error react-navigation types are not yet TS7-compatible; remove once react-navigation/react-navigation#13163 ships
        component={PushNotificationSettingsScreen}
      />
      <SettingsDrawer.Screen
        name="BlockedUsers"
        // @ts-expect-error react-navigation types are not yet TS7-compatible; remove once react-navigation/react-navigation#13163 ships
        component={BlockedUsersScreen}
      />
      <SettingsDrawer.Screen
        name="ManageAccount"
        // @ts-expect-error react-navigation types are not yet TS7-compatible; remove once react-navigation/react-navigation#13163 ships
        component={ManageAccountScreen}
      />
      {/* @ts-expect-error react-navigation types are not yet TS7-compatible; remove once react-navigation/react-navigation#13163 ships */}
      <SettingsDrawer.Screen name="BotSettings" component={BotSettingsScreen} />
      <SettingsDrawer.Screen
        name="BotMcpSettings"
        // @ts-expect-error react-navigation types are not yet TS7-compatible; remove once react-navigation/react-navigation#13163 ships
        component={BotMcpSettingsScreen}
      />
      <SettingsDrawer.Screen
        name="BotOtherSettings"
        // @ts-expect-error react-navigation types are not yet TS7-compatible; remove once react-navigation/react-navigation#13163 ships
        component={BotOtherSettingsScreen}
      />
      <SettingsDrawer.Screen
        name="FeatureFlags"
        // @ts-expect-error react-navigation types are not yet TS7-compatible; remove once react-navigation/react-navigation#13163 ships
        component={FeatureFlagScreen}
      />
      <SettingsDrawer.Screen
        name="PrivacySettings"
        // @ts-expect-error react-navigation types are not yet TS7-compatible; remove once react-navigation/react-navigation#13163 ships
        component={PrivacySettingsScreen}
      />
      {/* @ts-expect-error react-navigation types are not yet TS7-compatible; remove once react-navigation/react-navigation#13163 ships */}
      <SettingsDrawer.Screen name="WompWomp" component={UserBugReportScreen} />
    </SettingsDrawer.Navigator>
  );
};

function EmptySettingsScreen() {
  return <SettingsEmptyState />;
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
