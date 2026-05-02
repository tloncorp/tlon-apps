import { NavigationProp, useNavigation } from '@react-navigation/native';
import * as store from '@tloncorp/shared/store';
import { useCallback } from 'react';

import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { useOpenApp } from '../../hooks/useOpenApps';
import type { RootStackParamList } from '../../navigation/types';
import { AppLauncherView, NavBarView, View } from '../../ui';

export function AppLauncherScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const currentUserId = useCurrentUserId();
  const { data: apps = [], isLoading } = store.useInstalledApps();
  const openApp = useOpenApp();

  const handleSelectApp = useCallback(
    (app: store.InstalledApp) => {
      openApp(app.desk);
      navigation.navigate('AppViewer', { desk: app.desk });
    },
    [navigation, openApp]
  );

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <AppLauncherView
        apps={apps}
        isLoading={isLoading}
        onSelectApp={handleSelectApp}
      />
      <NavBarView
        navigateToContacts={() => {
          navigation.navigate('Contacts');
        }}
        navigateToHome={() => {
          navigation.navigate('ChatList');
        }}
        navigateToNotifications={() => {
          navigation.navigate('Activity');
        }}
        navigateToApps={() => {
          navigation.navigate('AppLauncher');
        }}
        currentRoute="AppLauncher"
        currentUserId={currentUserId}
      />
    </View>
  );
}
