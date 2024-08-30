import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { GroupRolesScreen } from '@tloncorp/app/features/groups/GroupRolesScreen';

import { GroupSettingsStackParamList } from '../types';

type GroupRolesScreenProps = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'GroupRoles'
>;

export function GroupRolesScreenController(props: GroupRolesScreenProps) {
  return (
    <GroupRolesScreen
      groupId={props.route.params.groupId}
      onGoBack={() => props.navigation.goBack()}
    />
  );
}
