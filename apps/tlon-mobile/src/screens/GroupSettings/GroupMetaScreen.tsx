import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { GroupMetaScreenView } from '@tloncorp/ui';

import { GroupSettingsStackParamList } from '../../types';
import { useGroupContext } from './useGroupContext';

type GroupMetaScreenProps = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'GroupMeta'
>;

export function GroupMetaScreen(props: GroupMetaScreenProps) {
  const { groupId } = props.route.params;

  const {
    group,
    currentUserIsAdmin,
    setGroupMetadata,
    uploadInfo,
    deleteGroup,
  } = useGroupContext({
    groupId,
  });

  return (
    <GroupMetaScreenView
      group={group ?? null}
      currentUserIsAdmin={currentUserIsAdmin ?? false}
      setGroupMetadata={setGroupMetadata}
      goBack={props.navigation.goBack}
      uploadInfo={uploadInfo}
      deleteGroup={deleteGroup}
    />
  );
}
