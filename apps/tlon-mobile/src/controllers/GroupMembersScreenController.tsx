import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { GroupMembersScreen } from '@tloncorp/app/features/groups/GroupMembersScreen';

import { GroupSettingsStackParamList } from '../types';

type GroupMembersScreenProps = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'GroupMembers'
>;

export function GroupMembersScreenController(props: GroupMembersScreenProps) {
  const { groupId } = props.route.params;

  return (
    <GroupMembersScreen
      onGoBack={() => props.navigation.goBack()}
      groupId={groupId}
    />
  );
}
