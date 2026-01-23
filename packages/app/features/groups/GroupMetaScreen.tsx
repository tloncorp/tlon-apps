import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { uploadAsset, useCanUpload } from '@tloncorp/shared/store';
import { useCallback, useState } from 'react';

import {
  useChatSettingsNavigation,
  useHandleGoBack,
} from '../../hooks/useChatSettingsNavigation';
import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { useGroupContext } from '../../hooks/useGroupContext';
import { GroupSettingsStackParamList } from '../../navigation/types';
import {
  AttachmentProvider,
  ConfirmDialog,
  MetaEditorScreenView,
  YStack,
  useGroupTitle,
  useToast,
} from '../../ui';

type Props = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'GroupMeta'
> & {
  navigateToHome: () => void;
};

export function GroupMetaScreen(props: Props) {
  const { groupId, fromBlankChannel, fromChatDetails } = props.route.params;
  const { navigation } = props;
  const { group, setGroupMetadata, deleteGroup } = useGroupContext({
    groupId,
  });
  const { onPressChatDetails } = useChatSettingsNavigation();
  const canUpload = useCanUpload();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const currentUserId = useCurrentUserId();
  const toast = useToast();

  const navigateToHome = useCallback(() => {
    navigation.getParent()?.navigate('ChatList');
  }, [navigation]);

  const handleGoBack = useHandleGoBack(navigation, {
    groupId,
    fromChatDetails,
    fromBlankChannel,
  });

  const { mutate, isPending } = store.useUpdateGroupMeta();

  const handleSubmit = useCallback(
    async (data: db.ClientMeta) => {
      if (!group) {
        return;
      }

      mutate(
        { ...group, ...data },
        {
          onSuccess: () => {
            if (fromBlankChannel) {
              navigation.goBack();
            } else if (fromChatDetails) {
              navigation.getParent()?.navigate('ChatDetails', {
                chatType: 'group',
                chatId: groupId,
              });
            } else {
              onPressChatDetails({ type: 'group', id: groupId });
            }
          },
          onError: (error: Error) => {
            toast({
              message: error.message,
              duration: 3000,
            });
          },
        }
      );
    },
    [
      toast,
      setGroupMetadata,
      groupId,
      onPressChatDetails,
      fromBlankChannel,
      fromChatDetails,
      navigation,
    ]
  );

  const handleDeleteGroup = useCallback(() => {
    deleteGroup();
    navigateToHome();
  }, [deleteGroup, navigateToHome]);

  const title = useGroupTitle(group);

  return (
    <AttachmentProvider canUpload={canUpload} uploadAsset={uploadAsset}>
      <MetaEditorScreenView
        chat={group}
        title={'Edit group info'}
        goBack={handleGoBack}
        onSubmit={handleSubmit}
        currentUserId={currentUserId}
        isPending={isPending}
      >
        <YStack flex={1} justifyContent="flex-end">
          <ConfirmDialog
            open={showDeleteDialog}
            onOpenChange={setShowDeleteDialog}
            title={`Delete ${title ?? 'This group'}?`}
            description="This action cannot be undone."
            confirmText="Delete group"
            cancelText="Cancel"
            onConfirm={handleDeleteGroup}
            destructive
          />
        </YStack>
      </MetaEditorScreenView>
    </AttachmentProvider>
  );
}
