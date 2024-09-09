import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { uploadAsset, useCanUpload } from '@tloncorp/shared/dist/store';
import {
  AttachmentProvider,
  Button,
  DeleteSheet,
  MetaEditorScreenView,
} from '@tloncorp/ui';
import { useCallback, useState } from 'react';

import { BRANCH_DOMAIN, BRANCH_KEY } from '../../constants';
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
  const { enabled, describe } = store.useLure({
    flag: groupId,
    branchDomain: BRANCH_DOMAIN,
    branchKey: BRANCH_KEY,
  });

  const handleSubmit = useCallback(
    (data: db.ClientMeta) => {
      setGroupMetadata(data);
      onGoBack();
      if (enabled) {
        describe({
          title: data.title ?? '',
          description: data.description ?? '',
          image: data.iconImage ?? '',
          cover: data.coverImage ?? '',
        });
      }
    },
    [setGroupMetadata, onGoBack, enabled, describe]
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
