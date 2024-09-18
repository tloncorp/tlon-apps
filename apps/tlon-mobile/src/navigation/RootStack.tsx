import { useFocusEffect } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useIsDarkMode } from '@tloncorp/app/hooks/useIsDarkMode';
import { useTheme } from '@tloncorp/ui';
import { Platform, StatusBar } from 'react-native';

import { ActivityScreenController } from '../controllers/ActivityScreenController';
import { AppInfoScreenController } from '../controllers/AppInfoScreenController';
import { BlockedUsersScreenController } from '../controllers/BlockedUsersScreenController';
import { ChannelMembersScreenController } from '../controllers/ChannelMembersScreenController';
import { ChannelMetaScreenController } from '../controllers/ChannelMetaScreenController';
import { ChannelScreenController } from '../controllers/ChannelScreenController';
import { ChannelSearchScreenController } from '../controllers/ChannelSearchScreenController';
import { ChatListScreenController } from '../controllers/ChatListScreenController';
import { EditProfileScreenController } from '../controllers/EditProfileScreenController';
import { FeatureFlagScreenController } from '../controllers/FeatureFlagScreenController';
import { FindGroupsScreenController } from '../controllers/FindGroupsScreenController';
import { GroupChannelsScreenController } from '../controllers/GroupChannelsScreenController';
import ImageViewerScreenController from '../controllers/ImageViewerScreenController';
import { ManageAccountScreenController } from '../controllers/ManageAccountScreenController';
import { PostScreenController } from '../controllers/PostScreenController';
import { PushNotificationSettingsScreenController } from '../controllers/PushNotificationSettingsScreenController';
import { UserBugReportScreenController } from '../controllers/UserBugReportScreenController';
import UserProfileScreenController from '../controllers/UserProfileScreenController';
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
        component={ChatListScreenController}
        options={{ animation: 'none', gestureEnabled: false }}
      />
      <Root.Screen
        name="Activity"
        component={ActivityScreenController}
        options={{ animation: 'none', gestureEnabled: false }}
      />
      <Root.Screen
        name="Profile"
        component={SettingsStack}
        options={{ animation: 'none', gestureEnabled: false }}
      />

      {/* individual screens */}
      <Root.Screen name="GroupSettings" component={GroupSettingsStack} />
      <Root.Screen name="FindGroups" component={FindGroupsScreenController} />
      <Root.Screen name="Channel" component={ChannelScreenController} />
      <Root.Screen
        name="ChannelSearch"
        component={ChannelSearchScreenController}
      />
      <Root.Screen name="Post" component={PostScreenController} />
      <Root.Screen
        name="GroupChannels"
        component={GroupChannelsScreenController}
      />
      <Root.Screen
        name="ImageViewer"
        component={ImageViewerScreenController}
        options={{ animation: 'fade' }}
      />

      <Root.Screen
        name="ManageAccount"
        component={ManageAccountScreenController}
        options={{ gestureEnabled: false }}
      />
      <Root.Screen
        name="BlockedUsers"
        component={BlockedUsersScreenController}
      />
      <Root.Screen name="AppInfo" component={AppInfoScreenController} />
      <Root.Screen
        name="FeatureFlags"
        component={FeatureFlagScreenController}
      />
      <Root.Screen
        name="PushNotificationSettings"
        component={PushNotificationSettingsScreenController}
      />
      <Root.Screen name="UserProfile" component={UserProfileScreenController} />
      <Root.Screen name="EditProfile" component={EditProfileScreenController} />
      <Root.Screen name="WompWomp" component={UserBugReportScreenController} />
      <Root.Screen
        name="ChannelMembers"
        component={ChannelMembersScreenController}
      />
      <Root.Screen name="ChannelMeta" component={ChannelMetaScreenController} />
    </Root.Navigator>
  );
}
