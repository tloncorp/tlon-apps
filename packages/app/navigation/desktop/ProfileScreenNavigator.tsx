import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, getVariableValue, useTheme } from '@tamagui/core';

import { AddContactsScreen } from '../../features/contacts/AddContactsScreen';
import { AppInfoScreen } from '../../features/settings/AppInfoScreen';
import { BlockedUsersScreen } from '../../features/settings/BlockedUsersScreen';
import { EditProfileScreen } from '../../features/settings/EditProfileScreen';
import { FeatureFlagScreen } from '../../features/settings/FeatureFlagScreen';
import { ManageAccountScreen } from '../../features/settings/ManageAccountScreen';
import ProfileScreen from '../../features/settings/ProfileScreen';
import { PushNotificationSettingsScreen } from '../../features/settings/PushNotificationSettingsScreen';
import { ThemeScreen } from '../../features/settings/ThemeScreen';
import { UserBugReportScreen } from '../../features/settings/UserBugReportScreen';
import ContactsScreen from '../../features/top/ContactsScreen';
import { UserProfileScreen } from '../../features/top/UserProfileScreen';

const ProfileScreenStack = createNativeStackNavigator();

export const ProfileScreenNavigator = () => {
  const backgroundColor = getVariableValue(useTheme().background);
  return (
    <View flex={1} backgroundColor={backgroundColor}>
      <View flex={1} width="100%" maxWidth={600} marginHorizontal="auto">
        <ProfileScreenStack.Navigator
          initialRouteName="Contacts"
          screenOptions={{
            headerShown: false,
          }}
        >
          <ProfileScreenStack.Screen
            name="Contacts"
            component={ContactsScreen}
          />
          <ProfileScreenStack.Screen
            name="AddContacts"
            component={AddContactsScreen}
          />
          <ProfileScreenStack.Screen name="Profile" component={ProfileScreen} />
          <ProfileScreenStack.Screen name="AppInfo" component={AppInfoScreen} />
          <ProfileScreenStack.Screen
            name="PushNotificationSettings"
            component={PushNotificationSettingsScreen}
          />
          <ProfileScreenStack.Screen
            name="BlockedUsers"
            component={BlockedUsersScreen}
          />
          <ProfileScreenStack.Screen
            name="ManageAccount"
            component={ManageAccountScreen}
          />
          <ProfileScreenStack.Screen
            name="FeatureFlags"
            component={FeatureFlagScreen}
          />
          <ProfileScreenStack.Screen
            name="WompWomp"
            component={UserBugReportScreen}
          />
          <ProfileScreenStack.Screen
            name="UserProfile"
            component={UserProfileScreen}
          />
          <ProfileScreenStack.Screen
            name="EditProfile"
            component={EditProfileScreen}
          />
          <ProfileScreenStack.Screen name="Theme" component={ThemeScreen} />
        </ProfileScreenStack.Navigator>
      </View>
    </View>
  );
};
