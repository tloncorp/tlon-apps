import { useFocusEffect } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform, StatusBar } from 'react-native';

import { ChannelMembersScreen } from '../features/channels/ChannelMembersScreen';
import { ChannelMetaScreen } from '../features/channels/ChannelMetaScreen';
import { ChannelTemplateScreen } from '../features/channels/ChannelTemplateScreen';
import { AddContactsScreen } from '../features/contacts/AddContactsScreen';
import { InviteSystemContactsScreen } from '../features/contacts/InviteSystemContactsScreen';
import { AttestationScreen } from '../features/profile/AttestationScreen';
import { AppInfoScreen } from '../features/settings/AppInfoScreen';
import { BlockedUsersScreen } from '../features/settings/BlockedUsersScreen';
import { EditProfileScreen } from '../features/settings/EditProfileScreen';
import { FeatureFlagScreen } from '../features/settings/FeatureFlagScreen';
import { ManageAccountScreen } from '../features/settings/ManageAccountScreen';
import { PrivacySettingsScreen } from '../features/settings/PrivacyScreen';
import { PushNotificationSettingsScreen } from '../features/settings/PushNotificationSettingsScreen';
import SettingsScreen from '../features/settings/SettingsScreen';
import { ThemeScreen } from '../features/settings/ThemeScreen';
import { UserBugReportScreen } from '../features/settings/UserBugReportScreen';
import { ActivityScreen } from '../features/top/ActivityScreen';
import ChannelScreen from '../features/top/ChannelScreen';
import ChannelSearchScreen from '../features/top/ChannelSearchScreen';
import { ChatDetailsScreen } from '../features/top/ChatDetailsScreen';
import ChatListScreen from '../features/top/ChatListScreen';
import { ChatVolumeScreen } from '../features/top/ChatVolumeScreen';
import ContactsScreen from '../features/top/ContactsScreen';
import { GroupChannelsScreen } from '../features/top/GroupChannelsScreen';
import ImageViewerScreen from '../features/top/ImageViewerScreen';
import PostScreen from '../features/top/PostScreen';
import { PostUsingContentConfigurationScreen } from '../features/top/PostUsingContentConfigurationScreen';
import { UserProfileScreen } from '../features/top/UserProfileScreen';
import { useIsDarkMode } from '../hooks/useIsDarkMode';
import { useFeatureFlag } from '../lib/featureFlags';
import { useTheme } from '../ui';
import { GroupSettingsStack } from './GroupSettingsStack';
import type { RootStackParamList } from './types';

const Root = createNativeStackNavigator<RootStackParamList>();

export function RootStack() {
  const isDarkMode = useIsDarkMode();
  const [contactsTabEnabled] = useFeatureFlag('contactsTab');

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
      initialRouteName={'ChatList'}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background?.val },
      }}
    >
      {/* top level tabs */}
      <Root.Screen
        name="Contacts"
        component={ContactsScreen}
        options={{ animation: 'none', gestureEnabled: false }}
      />
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
        name="Settings"
        component={SettingsScreen}
        options={{
          animation: contactsTabEnabled ? undefined : 'none',
          gestureEnabled: false,
        }}
      />

      {/* individual screens */}
      <Root.Screen name="AddContacts" component={AddContactsScreen} />
      <Root.Screen name="GroupSettings" component={GroupSettingsStack} />
      <Root.Screen name="Channel" component={ChannelScreen} />
      <Root.Screen name="DM" component={ChannelScreen} />
      <Root.Screen name="GroupDM" component={ChannelScreen} />
      <Root.Screen name="ChannelSearch" component={ChannelSearchScreen} />
      <Root.Screen name="Post" component={PostScreen} />
      <Root.Screen name="GroupChannels" component={GroupChannelsScreen} />
      <Root.Screen
        name="ImageViewer"
        component={ImageViewerScreen}
        options={{ animation: 'fade' }}
      />
      <Root.Screen name="ChatDetails" component={ChatDetailsScreen} />
      <Root.Screen name="ChatVolume" component={ChatVolumeScreen} />
      <Root.Screen
        name="ManageAccount"
        component={ManageAccountScreen}
        options={{ gestureEnabled: false }}
      />
      <Root.Screen name="BlockedUsers" component={BlockedUsersScreen} />
      <Root.Screen name="Theme" component={ThemeScreen} />
      <Root.Screen name="AppInfo" component={AppInfoScreen} />
      <Root.Screen name="FeatureFlags" component={FeatureFlagScreen} />
      <Root.Screen
        name="PushNotificationSettings"
        component={PushNotificationSettingsScreen}
      />
      <Root.Screen name="UserProfile" component={UserProfileScreen} />
      <Root.Screen name="Attestation" component={AttestationScreen} />
      <Root.Screen name="EditProfile" component={EditProfileScreen} />
      <Root.Screen name="WompWomp" component={UserBugReportScreen} />
      <Root.Screen name="PrivacySettings" component={PrivacySettingsScreen} />
      <Root.Screen name="ChannelMembers" component={ChannelMembersScreen} />
      <Root.Screen name="ChannelMeta" component={ChannelMetaScreen} />
      <Root.Screen
        name="PostUsingContentConfiguration"
        component={PostUsingContentConfigurationScreen}
      />
      <Root.Screen name="ChannelTemplate" component={ChannelTemplateScreen} />
      <Root.Screen
        name="InviteSystemContacts"
        component={InviteSystemContactsScreen}
      />
    </Root.Navigator>
  );
}
