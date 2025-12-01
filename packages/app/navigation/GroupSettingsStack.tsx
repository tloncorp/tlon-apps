import { NavigationProp } from '@react-navigation/native';
import {
  NativeStackNavigationProp,
  createNativeStackNavigator,
} from '@react-navigation/native-stack';

import { EditChannelScreen } from '../features/groups/EditChannelScreen';
import { GroupMembersScreen } from '../features/groups/GroupMembersScreen';
import { GroupMetaScreen } from '../features/groups/GroupMetaScreen';
import { GroupPrivacyScreen } from '../features/groups/GroupPrivacyScreen';
import { GroupRolesScreen } from '../features/groups/GroupRolesScreen';
import { ManageChannelsScreen } from '../features/groups/ManageChannelsScreen';
import { RoleFormScreen } from '../features/groups/RoleFormScreen';
import { SelectRoleMembersScreen } from '../features/groups/SelectRoleMembersScreen';
import { ChatVolumeScreen } from '../features/top/ChatVolumeScreen';
import { GroupSettingsStackParamList } from './types';

const GroupSettings = createNativeStackNavigator<GroupSettingsStackParamList>();

type GroupMetaProps = {
  navigation: NativeStackNavigationProp<
    GroupSettingsStackParamList,
    'GroupMeta'
  >;
  route: {
    key: string;
    name: 'GroupMeta';
    params: {
      groupId: string;
      fromBlankChannel?: boolean;
    };
  };
};

export function GroupSettingsStack({
  navigation,
}: {
  navigation: NavigationProp<GroupSettingsStackParamList>;
}) {
  const navigateToHome = () => {
    navigation.navigate('ChatList' as never);
  };

  return (
    <GroupSettings.Navigator screenOptions={{ headerShown: false }}>
      <GroupSettings.Screen name="GroupMeta">
        {(props: GroupMetaProps) => (
          <GroupMetaScreen {...props} navigateToHome={navigateToHome} />
        )}
      </GroupSettings.Screen>
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
      <GroupSettings.Screen name="EditRole" component={RoleFormScreen} />
      <GroupSettings.Screen name="AddRole" component={RoleFormScreen} />
      <GroupSettings.Screen
        name="SelectRoleMembers"
        component={SelectRoleMembersScreen}
        options={{ title: 'Select Members' }}
      />
      <GroupSettings.Screen name="ChatVolume" component={ChatVolumeScreen} />
    </GroupSettings.Navigator>
  );
}
