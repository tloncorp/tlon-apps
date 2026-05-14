import { NavigationProp } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ChannelInfoScreen } from '../features/groups/ChannelInfoScreen';
import { CreateChannelPermissionsScreen } from '../features/groups/CreateChannelPermissionsScreen';
import { EditChannelMetaScreen } from '../features/groups/EditChannelMetaScreen';
import { EditChannelPrivacyScreen } from '../features/groups/EditChannelPrivacyScreen';
import { GroupMembersScreen } from '../features/groups/GroupMembersScreen';
import { GroupMetaScreen } from '../features/groups/GroupMetaScreen';
import { GroupPrivacyScreen } from '../features/groups/GroupPrivacyScreen';
import { GroupRolesScreen } from '../features/groups/GroupRolesScreen';
import { ManageChannelsScreen } from '../features/groups/ManageChannelsScreen';
import { RoleFormScreen } from '../features/groups/RoleFormScreen';
import { SelectChannelRolesScreen } from '../features/groups/SelectChannelRolesScreen';
import { SelectRoleMembersScreen } from '../features/groups/SelectRoleMembersScreen';
import { ChatVolumeScreen } from '../features/top/ChatVolumeScreen';
import { GroupSettingsStackParamList } from './types';

const GroupSettings = createNativeStackNavigator<GroupSettingsStackParamList>();

export function GroupSettingsStack({
  navigation,
}: {
  navigation: NavigationProp<GroupSettingsStackParamList>;
}) {
  return (
    <GroupSettings.Navigator screenOptions={{ headerShown: false }}>
      <GroupSettings.Screen name="GroupMeta" component={GroupMetaScreen} />
      <GroupSettings.Screen name="ChannelInfo" component={ChannelInfoScreen} />
      <GroupSettings.Screen
        name="GroupMembers"
        component={GroupMembersScreen}
      />
      <GroupSettings.Screen
        name="ManageChannels"
        component={ManageChannelsScreen}
      />
      <GroupSettings.Screen
        name="EditChannelMeta"
        component={EditChannelMetaScreen}
      />
      <GroupSettings.Screen
        name="EditChannelPrivacy"
        component={EditChannelPrivacyScreen}
      />
      <GroupSettings.Screen name="Privacy" component={GroupPrivacyScreen} />
      <GroupSettings.Screen name="GroupRoles" component={GroupRolesScreen} />
      <GroupSettings.Screen name="EditRole" component={RoleFormScreen} />
      <GroupSettings.Screen name="AddRole" component={RoleFormScreen} />
      <GroupSettings.Screen
        name="SelectRoleMembers"
        component={SelectRoleMembersScreen}
        options={{ title: 'Select Members' }}
      />
      <GroupSettings.Screen
        name="CreateChannelPermissions"
        component={CreateChannelPermissionsScreen}
      />
      <GroupSettings.Screen
        name="SelectChannelRoles"
        component={SelectChannelRolesScreen}
      />
      <GroupSettings.Screen name="ChatVolume" component={ChatVolumeScreen} />
    </GroupSettings.Navigator>
  );
}
