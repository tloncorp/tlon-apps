import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { uploadAsset, useCanUpload } from '@tloncorp/shared/store';
import { useCallback } from 'react';

import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { RootStackParamList } from '../../navigation/types';
import { AttachmentProvider, MetaEditorScreenView } from '../../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'ChannelMeta'>;

export function ChannelMetaScreen(props: Props) {
  const { channelId } = props.route.params;
  const channelQuery = store.useChannel({ id: channelId });
  const canUpload = useCanUpload();
  const currentUserId = useCurrentUserId();

  const handleSubmit = useCallback(
    (meta: db.ClientMeta) => {
      store.updateDMMeta(channelId, meta);
      () => props.navigation.goBack();
    },
    [channelId, props.navigation]
  );

  return (
    <AttachmentProvider canUpload={canUpload} uploadAsset={uploadAsset}>
      <MetaEditorScreenView
        chat={channelQuery.data}
        onSubmit={handleSubmit}
        goBack={() => props.navigation.goBack()}
        title={'Edit chat info'}
        currentUserId={currentUserId}
      />
    </AttachmentProvider>
  );
}
