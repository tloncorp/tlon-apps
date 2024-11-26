import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AppInfoScreen } from '../../features/settings/AppInfoScreen';
import { BlockedUsersScreen } from '../../features/settings/BlockedUsersScreen';
import { FeatureFlagScreen } from '../../features/settings/FeatureFlagScreen';
import { ManageAccountScreen } from '../../features/settings/ManageAccountScreen';
import ProfileScreen from '../../features/settings/ProfileScreen';
import { PushNotificationSettingsScreen } from '../../features/settings/PushNotificationSettingsScreen';
import { UserBugReportScreen } from '../../features/settings/UserBugReportScreen';
import { UserProfileScreen } from '../../features/top/UserProfileScreen';

const ProfileScreenStack = createNativeStackNavigator();

export const ProfileScreenNavigator = () => {
  return (
    <ProfileScreenStack.Navigator
      initialRouteName="ProfileScreen"
      screenOptions={{
        headerShown: false,
      }}
    >
      <ProfileScreenStack.Screen
        name="ProfileScreen"
        component={ProfileScreen}
      />
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
    </ProfileScreenStack.Navigator>
  );
};
