import { useFocusEffect } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '@tloncorp/ui';
import { Platform, StatusBar } from 'react-native';

import { useIsDarkMode } from '../hooks/useIsDarkMode';
import { ActivityScreen } from '../screens/ActivityScreen';
import { AppInfoScreen } from '../screens/AppInfo';
import { AppSettingsScreen } from '../screens/AppSettingsScreen';
import { BlockedUsersScreen } from '../screens/BlockedUsersScreen';
import ChannelScreen from '../screens/ChannelScreen';
import ChannelSearch from '../screens/ChannelSearchScreen';
import ChatListScreen from '../screens/ChatListScreen';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import { FeatureFlagScreen } from '../screens/FeatureFlagScreen';
import { GroupChannelsScreen } from '../screens/GroupChannelsScreen';
import ImageViewerScreen from '../screens/ImageViewerScreen';
import { ManageAccountScreen } from '../screens/ManageAccountScreen';
import PostScreen from '../screens/PostScreen';
import { PushNotificationSettingsScreen } from '../screens/PushNotificationSettingsScreen';
import type { RootStackParamList } from '../types';
import { GroupSettingsStack } from './GroupSettingsStack';
import { SettingsStack } from './SettingsStack';

const Root = createNativeStackNavigator<RootStackParamList>();

export function RootStack() {
  const isDarkMode = useIsDarkMode();

  // Android status bar has a solid color by default, so we clear it
  useFocusEffect(() => {
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor('transparent');
      StatusBar.setBarStyle(isDarkMode ? 'light-content' : 'dark-content');
    }
  });

  const theme = useTheme();

  return (
    <Root.Navigator
      initialRouteName="ChatList"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background.val },
      }}
    >
      {/* top level tabs */}
      <Root.Screen
        name="ChatList"
        component={ChatListScreen}
        options={{ animation: 'none', gestureEnabled: false }}
      />
      <Root.Screen
        name="Activity"
        component={ActivityScreen}
        options={{ animation: 'none', gestureEnabled: false }}
      />
      <Root.Screen
        name="Profile"
        component={SettingsStack}
        options={{ animation: 'none', gestureEnabled: false }}
      />

      {/* individual screens */}
      <Root.Screen name="GroupSettings" component={GroupSettingsStack} />
      <Root.Screen name="Channel" component={ChannelScreen} />
      <Root.Screen name="ChannelSearch" component={ChannelSearch} />
      <Root.Screen name="Post" component={PostScreen} />
      <Root.Screen name="GroupChannels" component={GroupChannelsScreen} />
      <Root.Screen
        name="ImageViewer"
        component={ImageViewerScreen}
        options={{ animation: 'fade' }}
      />

      <Root.Screen name="AppSettings" component={AppSettingsScreen} />
      <Root.Screen name="ManageAccount" component={ManageAccountScreen} />
      <Root.Screen name="BlockedUsers" component={BlockedUsersScreen} />
      <Root.Screen name="AppInfo" component={AppInfoScreen} />
      <Root.Screen name="FeatureFlags" component={FeatureFlagScreen} />
      <Root.Screen
        name="PushNotificationSettings"
        component={PushNotificationSettingsScreen}
      />
      <Root.Screen name="EditProfile" component={EditProfileScreen} />
    </Root.Navigator>
  );
}
