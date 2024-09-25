import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { EditChannelScreen } from '../features/groups/EditChannelScreen';
import { GroupMembersScreen } from '../features/groups/GroupMembersScreen';
import { GroupMetaScreen } from '../features/groups/GroupMetaScreen';
import { GroupPrivacyScreen } from '../features/groups/GroupPrivacyScreen';
import { GroupRolesScreen } from '../features/groups/GroupRolesScreen';
import { ManageChannelsScreen } from '../features/groups/ManageChannelsScreen';
import { GroupSettingsStackParamList } from './types';

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
