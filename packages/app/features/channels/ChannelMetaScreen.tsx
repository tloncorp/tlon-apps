import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { uploadAsset, useCanUpload } from '@tloncorp/shared/dist/store';
import { AttachmentProvider, MetaEditorScreenView } from '@tloncorp/ui';
import { useCallback } from 'react';

import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ChannelMeta'>;

export function ChannelMetaScreen(props: Props) {
  const { channelId } = props.route.params;
  const channelQuery = store.useChannel({ id: channelId });
  const canUpload = useCanUpload();

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
      />
    </AttachmentProvider>
  );
}
