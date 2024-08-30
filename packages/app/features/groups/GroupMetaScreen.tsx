import * as db from '@tloncorp/shared/dist/db';
import { uploadAsset, useCanUpload } from '@tloncorp/shared/dist/store';
import {
  AttachmentProvider,
  Button,
  DeleteSheet,
  MetaEditorScreenView,
} from '@tloncorp/ui';
import { useCallback, useState } from 'react';

import { useGroupContext } from '../../hooks/useGroupContext';

export function GroupMetaScreen({
  groupId,
  onGoBack,
}: {
  groupId: string;
  onGoBack: () => void;
}) {
  const { group, setGroupMetadata, deleteGroup } = useGroupContext({
    groupId,
  });
  const canUpload = useCanUpload();
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);

  const handleSubmit = useCallback(
    (data: db.ClientMeta) => {
      setGroupMetadata(data);
      onGoBack();
    },
    [setGroupMetadata, onGoBack]
  );

  const handlePressDelete = useCallback(() => {
    setShowDeleteSheet(true);
  }, []);

  return (
    <AttachmentProvider canUpload={canUpload} uploadAsset={uploadAsset}>
      <MetaEditorScreenView
        chat={group}
        title={'Edit group info'}
        goBack={onGoBack}
        onSubmit={handleSubmit}
      >
        <Button heroDestructive onPress={handlePressDelete}>
          <Button.Text>Delete group for everyone</Button.Text>
        </Button>
        <DeleteSheet
          title={group?.title ?? 'This Group'}
          itemTypeDescription="group"
          open={showDeleteSheet}
          onOpenChange={setShowDeleteSheet}
          deleteAction={deleteGroup}
        />
      </MetaEditorScreenView>
    </AttachmentProvider>
  );
}
