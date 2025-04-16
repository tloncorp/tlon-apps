import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { uploadAsset, useCanUpload } from '@tloncorp/shared/store';
import { useCallback, useState } from 'react';

import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { useGroupContext } from '../../hooks/useGroupContext';
import { GroupSettingsStackParamList } from '../../navigation/types';
import {
  AttachmentProvider,
  DeleteSheet,
  MetaEditorScreenView,
  YStack,
  useGroupTitle,
} from '../../ui';

type Props = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'GroupMeta'
> & {
  navigateToHome: () => void;
};

export function GroupMetaScreen(props: Props) {
  const { groupId, fromBlankChannel } = props.route.params;
  const { group, setGroupMetadata, deleteGroup } = useGroupContext({
    groupId,
  });
  const { onPressChatDetails } = useChatSettingsNavigation();
  const canUpload = useCanUpload();
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  const currentUserId = useCurrentUserId();

  const handleSubmit = useCallback(
    (data: db.ClientMeta) => {
      setGroupMetadata(data);

      // If coming from a blank channel, go back instead of navigating to chat details
      if (fromBlankChannel) {
        props.navigation.goBack();
      } else {
        // Default behavior - navigate to chat details
        onPressChatDetails({ type: 'group', id: groupId });
      }

      store.createGroupInviteLink(groupId);
    },
    [
      setGroupMetadata,
      groupId,
      onPressChatDetails,
      fromBlankChannel,
      props.navigation,
    ]
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
        currentUserId={currentUserId}
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
