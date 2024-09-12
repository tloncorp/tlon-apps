import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { GroupMetaScreen } from '@tloncorp/app/features/groups/GroupMetaScreen';

import { GroupSettingsStackParamList } from '../types';

type GroupMetaScreenProps = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'GroupMeta'
>;

export function GroupMetaScreenController(props: GroupMetaScreenProps) {
  const { groupId } = props.route.params;

  return (
    <GroupMetaScreen
      groupId={groupId}
      onGoBack={() => props.navigation.goBack()}
    />
  );
}
