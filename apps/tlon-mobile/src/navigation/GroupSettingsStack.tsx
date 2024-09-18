import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { EditChannelScreenController } from '../controllers/EditChannelScreenController';
import { GroupMembersScreenController } from '../controllers/GroupMembersScreenController';
import { GroupMetaScreenController } from '../controllers/GroupMetaScreenController';
import { GroupPrivacyScreenController } from '../controllers/GroupPrivacyScreenController';
import { GroupRolesScreenController } from '../controllers/GroupRolesScreenController';
import { ManageChannelsScreenController } from '../controllers/ManageChannelsScreenController';
import { GroupSettingsStackParamList } from '../types';

const GroupSettings = createNativeStackNavigator<GroupSettingsStackParamList>();

export function GroupSettingsStack() {
  return (
    <GroupSettings.Navigator screenOptions={{ headerShown: false }}>
      <GroupSettings.Screen
        name="GroupMeta"
        component={GroupMetaScreenController}
      />
      <GroupSettings.Screen
        name="GroupMembers"
        component={GroupMembersScreenController}
      />
      <GroupSettings.Screen
        name="ManageChannels"
        component={ManageChannelsScreenController}
      />
      <GroupSettings.Screen
        name="EditChannel"
        component={EditChannelScreenController}
      />
      <GroupSettings.Screen
        name="Privacy"
        component={GroupPrivacyScreenController}
      />
      <GroupSettings.Screen
        name="GroupRoles"
        component={GroupRolesScreenController}
      />
    </GroupSettings.Navigator>
  );
}
