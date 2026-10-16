import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import { uploadAsset, useCanUpload } from '@tloncorp/shared/store';
import { useCallback } from 'react';

import {
  useChatSettingsNavigation,
  useHandleGoBack,
} from '../../hooks/useChatSettingsNavigation';
import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { useGroupContext } from '../../hooks/useGroupContext';
import { GroupSettingsStackParamList } from '../../navigation/types';
import {
  AttachmentProvider,
  MetaEditorScreenView,
  useIsWindowNarrow,
} from '../../ui';
import { useShipConnectionStatus } from '../top/useShipConnectionStatus';

type Props = NativeStackScreenProps<GroupSettingsStackParamList, 'GroupMeta'>;

export function GroupMetaScreen(props: Props) {
  const { groupId, fromBlankChannel, fromChatDetails } = props.route.params;
  const { navigation } = props;
  const { group, setGroupMetadata } = useGroupContext({
    groupId,
  });
  const { onPressChatDetails } = useChatSettingsNavigation();
  const canUpload = useCanUpload();
  const currentUserId = useCurrentUserId();
  const isWindowNarrow = useIsWindowNarrow();
  const hostStatus = useShipConnectionStatus(group?.hostUserId ?? '', {
    enabled: !!group,
  });

  const handleGoBack = useHandleGoBack(navigation, {
    groupId,
    fromChatDetails,
    fromBlankChannel,
  });

  const handleSubmit = useCallback(
    (data: db.ClientMeta) => {
      setGroupMetadata(data);

      if (fromBlankChannel) {
        navigation.goBack();
      } else if (fromChatDetails) {
        // Same RN7 issue as the back path in useHandleGoBack: on narrow,
        // the old navigate('ChatDetails', ...) pushed a duplicate route
        // instead of popping to the existing one, so pop the GroupSettings
        // stack with goBack() to return to the sibling ChatDetails. Wide
        // keeps the pre-existing cross-navigator navigate, which already
        // worked correctly for this flow.
        if (isWindowNarrow) {
          navigation.goBack();
        } else {
          navigation
            .getParent()
            ?.navigate('ChatDetails', { chatType: 'group', chatId: groupId });
        }
      } else {
        onPressChatDetails({ type: 'group', id: groupId });
      }
    },
    [
      setGroupMetadata,
      groupId,
      onPressChatDetails,
      fromBlankChannel,
      fromChatDetails,
      isWindowNarrow,
      navigation,
    ]
  );

  return (
    <AttachmentProvider canUpload={canUpload} uploadAsset={uploadAsset}>
      <MetaEditorScreenView
        chat={group}
        title={'Edit group info'}
        goBack={handleGoBack}
        onSubmit={handleSubmit}
        currentUserId={currentUserId}
        hostStatus={hostStatus}
      />
    </AttachmentProvider>
  );
}
