import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { uploadAsset, useCanUpload } from '@tloncorp/shared/dist/store';
import { AttachmentProvider, MetaEditorScreenView } from '@tloncorp/ui';
import { useCallback } from 'react';

export function ChannelMetaScreen({
  channelId,
  onGoBack,
}: {
  channelId: string;
  onGoBack: () => void;
}) {
  const channelQuery = store.useChannel({ id: channelId });
  const canUpload = useCanUpload();

  const handleSubmit = useCallback(
    (meta: db.ClientMeta) => {
      store.updateDMMeta(channelId, meta);
      onGoBack();
    },
    [channelId, onGoBack]
  );

  return (
    <AttachmentProvider canUpload={canUpload} uploadAsset={uploadAsset}>
      <MetaEditorScreenView
        chat={channelQuery.data}
        onSubmit={handleSubmit}
        goBack={onGoBack}
        title={'Edit chat info'}
      />
    </AttachmentProvider>
  );
}
