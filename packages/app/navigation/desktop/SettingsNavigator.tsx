import {
  DrawerContentComponentProps,
  createDrawerNavigator,
} from '@react-navigation/drawer';
import { View, getVariableValue, useTheme } from '@tamagui/core';
import * as db from '@tloncorp/shared/db';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { AppInfoScreen } from '../../features/settings/AppInfoScreen';
import { BlockedUsersScreen } from '../../features/settings/BlockedUsersScreen';
import { FeatureFlagScreen } from '../../features/settings/FeatureFlagScreen';
import { ManageAccountScreen } from '../../features/settings/ManageAccountScreen';
import { PrivacySettingsScreen } from '../../features/settings/PrivacyScreen';
import { PushNotificationSettingsScreen } from '../../features/settings/PushNotificationSettingsScreen';
import { ThemeScreen } from '../../features/settings/ThemeScreen';
import { UserBugReportScreen } from '../../features/settings/UserBugReportScreen';
import { useDMLureLink } from '../../hooks/useBranchLink';
import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { useHandleLogout } from '../../hooks/useHandleLogout';
import { useResetDb } from '../../hooks/useResetDb';
import { DESKTOP_SIDEBAR_WIDTH, SettingsScreenView } from '../../ui';

const SettingsDrawer = createDrawerNavigator();

function DrawerContent(props: DrawerContentComponentProps) {
  const { navigate } = props.navigation;
  const resetDb = useResetDb();
  const handleLogout = useHandleLogout({ resetDb });
  const currentUserId = useCurrentUserId();
  const { dmLink } = useDMLureLink();
  const hasHostedAuth = useHasHostedAuth();
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
      onExperimentalFeaturesPressed={onExperimentalFeaturesPressed}
      onThemePressed={onThemePressed}
      onPrivacyPressed={onPrivacyPressed}
      dmLink={dmLink}
      focusedRouteName={focusedRoute.name}
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
      <SettingsDrawer.Screen name="Theme" component={ThemeScreen} />
      <SettingsDrawer.Screen name="AppInfo" component={AppInfoScreen} />
      <SettingsDrawer.Screen
        name="PushNotificationSettings"
        component={PushNotificationSettingsScreen}
      />
      <SettingsDrawer.Screen
        name="BlockedUsers"
        component={BlockedUsersScreen}
      />
      <SettingsDrawer.Screen
        name="ManageAccount"
        component={ManageAccountScreen}
      />
      <SettingsDrawer.Screen
        name="FeatureFlags"
        component={FeatureFlagScreen}
      />
      <SettingsDrawer.Screen
        name="PrivacySettings"
        component={PrivacySettingsScreen}
      />
      <SettingsDrawer.Screen name="WompWomp" component={UserBugReportScreen} />
    </SettingsDrawer.Navigator>
  );
};

function EmptySettingsScreen() {
  return (
    <View
      flex={1}
      backgroundColor={getVariableValue(useTheme().secondaryBackground)}
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
