import {
  DrawerContentComponentProps,
  createDrawerNavigator,
} from '@react-navigation/drawer';
import { getVariableValue, useTheme } from '@tamagui/core';
import { getCurrentUserIsHosted } from '@tloncorp/api';
import * as db from '@tloncorp/shared/db';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { SettingsDrawerParamList } from '../types';
import { AppInfoScreen } from '../../features/settings/AppInfoScreen';
import { BlockedUsersScreen } from '../../features/settings/BlockedUsersScreen';
import { BotApiKeySettingsScreen } from '../../features/settings/BotApiKeySettingsScreen';
import { BotChannelRuleSettingsScreen } from '../../features/settings/BotChannelRuleSettingsScreen';
import { BotChannelRulesScreen } from '../../features/settings/BotChannelRulesScreen';
import { BotIdentitySettingsScreen } from '../../features/settings/BotIdentitySettingsScreen';
import { BotMcpSettingsScreen } from '../../features/settings/BotMcpSettingsScreen';
import { BotModelSettingsScreen } from '../../features/settings/BotModelSettingsScreen';
import { BotOpenAISubscriptionScreen } from '../../features/settings/BotOpenAISubscriptionScreen';
import { BotPermissionsSettingsScreen } from '../../features/settings/BotPermissionsSettingsScreen';
import { BotProviderListSettingsScreen } from '../../features/settings/BotProviderListSettingsScreen';
import { BotSettingsScreen } from '../../features/settings/BotSettingsScreen';
import { BotShipListSettingsScreen } from '../../features/settings/BotShipListSettingsScreen';
import { FeatureFlagScreen } from '../../features/settings/FeatureFlagScreen';
import { ManageAccountScreen } from '../../features/settings/ManageAccountScreen';
import { PrivacySettingsScreen } from '../../features/settings/PrivacyScreen';
import { PushNotificationSettingsScreen } from '../../features/settings/PushNotificationSettingsScreen';
import { ThemeScreen } from '../../features/settings/ThemeScreen';
import { UserBugReportScreen } from '../../features/settings/UserBugReportScreen';
import { SettingsEmptyState } from '../../features/top/DesktopEmptyStates';
import { useSettingsRowLabels } from '../../features/settings/useSettingsRowLabels';
import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { useHandleLogout } from '../../hooks/useHandleLogout';
import { useResetDb } from '../../hooks/useResetDb';
import { SettingsScreenView } from '../../ui';
import {
  openExternalBotSettings,
  useHasExpectedBotDm,
} from '../../utils/botSettings';
import {
  ListPaneSafeArea,
  detailPaneScreenLayout,
} from './PaneSafeAreaProvider';
import { useSplitPaneWidths } from './splitPaneWidths';

const SettingsDrawer = createDrawerNavigator<SettingsDrawerParamList>();

function DrawerContent(props: DrawerContentComponentProps) {
  const { navigate } = props.navigation;
  const resetDb = useResetDb();
  const handleLogout = useHandleLogout({ resetDb });
  const currentUserId = useCurrentUserId();
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
  const { themeLabel, notificationsLabel } = useSettingsRowLabels();

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
      focusedRouteName={focusedRoute.name}
      botEnabled={botEnabled}
      themeLabel={themeLabel}
      notificationsLabel={notificationsLabel}
    />
  );
}

export const SettingsNavigator = () => {
  const { listPaneWidth } = useSplitPaneWidths();
  return (
    <SettingsDrawer.Navigator
      initialRouteName="SettingsEmpty"
      // Back should return to the previously focused screen (e.g. the
      // BotSettings hub that holds the Apply bar), not the drawer's first route.
      // The default 'firstRoute' would strand pending bot edits after
      // BotSettings -> BotModelSettings -> Done.
      backBehavior="history"
      drawerContent={(props) => (
        <ListPaneSafeArea>
          <DrawerContent {...props} />
        </ListPaneSafeArea>
      )}
      screenLayout={detailPaneScreenLayout}
      screenOptions={{
        headerShown: false,
        drawerType: 'permanent',
        drawerStyle: {
          width: listPaneWidth,
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
      <SettingsDrawer.Screen name="BotSettings" component={BotSettingsScreen} />
      <SettingsDrawer.Screen
        name="BotMcpSettings"
        component={BotMcpSettingsScreen}
      />
      <SettingsDrawer.Screen
        name="BotModelSettings"
        component={BotModelSettingsScreen}
      />
      <SettingsDrawer.Screen
        name="BotApiKeySettings"
        component={BotApiKeySettingsScreen}
      />
      <SettingsDrawer.Screen
        name="BotOpenAISubscription"
        component={BotOpenAISubscriptionScreen}
      />
      <SettingsDrawer.Screen
        name="BotShipListSettings"
        component={BotShipListSettingsScreen}
      />
      <SettingsDrawer.Screen
        name="BotChannelRulesSettings"
        component={BotChannelRulesScreen}
      />
      <SettingsDrawer.Screen
        name="BotChannelRuleSettings"
        component={BotChannelRuleSettingsScreen}
      />
      <SettingsDrawer.Screen
        name="BotPermissionsSettings"
        component={BotPermissionsSettingsScreen}
      />
      <SettingsDrawer.Screen
        name="BotIdentitySettings"
        component={BotIdentitySettingsScreen}
      />
      <SettingsDrawer.Screen
        name="BotProviderListSettings"
        component={BotProviderListSettingsScreen}
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
