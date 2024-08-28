import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { EditChannelScreen } from '../screens/GroupSettings/EditChannelScreen';
import { GroupMembersScreen } from '../screens/GroupSettings/GroupMembersScreen';
import { GroupMetaScreen } from '../screens/GroupSettings/GroupMetaScreen';
import { GroupPrivacyScreen } from '../screens/GroupSettings/GroupPrivacyScreen';
import { GroupRolesScreen } from '../screens/GroupSettings/GroupRolesScreen';
import { ManageChannelsScreen } from '../screens/GroupSettings/ManageChannelsScreen';
import { GroupSettingsStackParamList } from '../types';

const GroupSettings = createNativeStackNavigator<GroupSettingsStackParamList>();

export function GroupSettingsStack() {
  return (
    <GroupSettings.Navigator screenOptions={{ headerShown: false }}>
      <GroupSettings.Screen name="GroupMeta" component={GroupMetaScreen} />
      <GroupSettings.Screen
        name="GroupMembers"
        component={GroupMembersScreen}
      />
      <GroupSettings.Screen
        name="ManageChannels"
        component={ManageChannelsScreen}
      />
      <GroupSettings.Screen name="EditChannel" component={EditChannelScreen} />
      <GroupSettings.Screen name="Privacy" component={GroupPrivacyScreen} />
      <GroupSettings.Screen name="GroupRoles" component={GroupRolesScreen} />
    </GroupSettings.Navigator>
  );
}
