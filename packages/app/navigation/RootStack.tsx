import { useFocusEffect } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '@tloncorp/ui';
import { Platform, StatusBar } from 'react-native';

import { ChannelMembersScreen } from '../features/channels/ChannelMembersScreen';
import { ChannelMetaScreen } from '../features/channels/ChannelMetaScreen';
import { AppInfoScreen } from '../features/settings/AppInfoScreen';
import { BlockedUsersScreen } from '../features/settings/BlockedUsersScreen';
import { EditProfileScreen } from '../features/settings/EditProfileScreen';
import { FeatureFlagScreen } from '../features/settings/FeatureFlagScreen';
import { ManageAccountScreen } from '../features/settings/ManageAccountScreen';
import { PushNotificationSettingsScreen } from '../features/settings/PushNotificationSettingsScreen';
import { UserBugReportScreen } from '../features/settings/UserBugReportScreen';
import { ActivityScreen } from '../features/top/ActivityScreen';
import ChannelScreen from '../features/top/ChannelScreen';
import ChannelSearchScreen from '../features/top/ChannelSearchScreen';
import ChatListScreen from '../features/top/ChatListScreen';
import { ContactHostedGroupsScreen } from '../features/top/ContactHostedGroupsScreen';
import { CreateGroupScreen } from '../features/top/CreateGroupScreen';
import { FindGroupsScreen } from '../features/top/FindGroupsScreen';
import { GroupChannelsScreen } from '../features/top/GroupChannelsScreen';
import ImageViewerScreen from '../features/top/ImageViewerScreen';
import PostScreen from '../features/top/PostScreen';
import { UserProfileScreen } from '../features/top/UserProfileScreen';
import { useIsDarkMode } from '../hooks/useIsDarkMode';
import { GroupSettingsStack } from './GroupSettingsStack';
import { SettingsStack } from './SettingsStack';
import type { RootStackParamList } from './types';

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
        contentStyle: { backgroundColor: theme.background?.val },
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
      <Root.Screen name="FindGroups" component={FindGroupsScreen} />
      <Root.Screen
        name="ContactHostedGroups"
        component={ContactHostedGroupsScreen}
      />
      <Root.Screen name="CreateGroup" component={CreateGroupScreen} />
      <Root.Screen name="Channel" component={ChannelScreen} />
      <Root.Screen name="ChannelSearch" component={ChannelSearchScreen} />
      <Root.Screen name="Post" component={PostScreen} />
      <Root.Screen name="GroupChannels" component={GroupChannelsScreen} />
      <Root.Screen
        name="ImageViewer"
        component={ImageViewerScreen}
        options={{ animation: 'fade' }}
      />

      <Root.Screen
        name="ManageAccount"
        component={ManageAccountScreen}
        options={{ gestureEnabled: false }}
      />
      <Root.Screen name="BlockedUsers" component={BlockedUsersScreen} />
      <Root.Screen name="AppInfo" component={AppInfoScreen} />
      <Root.Screen name="FeatureFlags" component={FeatureFlagScreen} />
      <Root.Screen
        name="PushNotificationSettings"
        component={PushNotificationSettingsScreen}
      />
      <Root.Screen name="UserProfile" component={UserProfileScreen} />
      <Root.Screen name="EditProfile" component={EditProfileScreen} />
      <Root.Screen name="WompWomp" component={UserBugReportScreen} />
      <Root.Screen name="ChannelMembers" component={ChannelMembersScreen} />
      <Root.Screen name="ChannelMeta" component={ChannelMetaScreen} />
    </Root.Navigator>
  );
}
