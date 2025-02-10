import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { uploadAsset, useCanUpload } from '@tloncorp/shared/store';
import {
  AttachmentProvider,
  Button,
  DeleteSheet,
  MetaEditorScreenView,
  YStack,
  useGroupTitle,
} from '@tloncorp/ui';
import { useCallback, useState } from 'react';

import {
  INVITE_SERVICE_ENDPOINT,
  INVITE_SERVICE_IS_DEV,
} from '../../constants';
import { useGroupContext } from '../../hooks/useGroupContext';
import { GroupSettingsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'GroupMeta'
> & {
  navigateToHome: () => void;
};

export function GroupMetaScreen(props: Props) {
  const { groupId } = props.route.params;
  const { group, setGroupMetadata, deleteGroup } = useGroupContext({
    groupId,
  });
  const canUpload = useCanUpload();
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);

  const handleSubmit = useCallback(
    (data: db.ClientMeta) => {
      setGroupMetadata(data);
      props.navigation.goBack();
      store.createGroupInviteLink(groupId);
    },
    [setGroupMetadata, props.navigation, groupId]
  );

  const handlePressDelete = useCallback(() => {
    setShowDeleteSheet(true);
  }, []);

  const handleDeleteGroup = useCallback(() => {
    deleteGroup();
    props.navigateToHome();
  }, [deleteGroup, props]);

  const title = useGroupTitle(group);

  return (
    <AttachmentProvider canUpload={canUpload} uploadAsset={uploadAsset}>
      <MetaEditorScreenView
        chat={group}
        title={'Edit group info'}
        goBack={props.navigation.goBack}
        onSubmit={handleSubmit}
      >
        <YStack flex={1} justifyContent="flex-end">
          <DeleteSheet
            title={title ?? 'This group'}
            itemTypeDescription="group"
            open={showDeleteSheet}
            onOpenChange={setShowDeleteSheet}
            deleteAction={handleDeleteGroup}
          />
        </YStack>
      </MetaEditorScreenView>
    </AttachmentProvider>
  );
}
