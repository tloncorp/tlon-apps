import { useState } from 'react';

import { useMessageInputContext } from '../contexts/messageInput';
import { ActionSheet } from './ActionSheet';
import AttachmentSheet from './AttachmentSheet';

export default function AddGalleryPost({
  showAddGalleryPost,
  setShowAddGalleryPost,
  setShowGalleryInput,
}: {
  showAddGalleryPost: boolean;
  setShowAddGalleryPost: (show: boolean) => void;
  setShowGalleryInput: (show: boolean) => void;
}) {
  const { attachAssets } = useMessageInputContext();
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);

  const actions = [
    {
      title: 'Photo or Video',
      action: () => {
        setShowAddGalleryPost(false);
        setShowAttachmentSheet(true);
      },
    },
    {
      title: 'Rich Text',
      action: () => {
        setShowAddGalleryPost(false);
        setShowGalleryInput(true);
      },
    },
  ];

  return (
    <>
      <ActionSheet
        open={showAddGalleryPost}
        onOpenChange={(open: boolean) => setShowAddGalleryPost(open)}
      >
        {actions.map((action, index) => (
          <ActionSheet.Action key={index} action={action.action}>
            <ActionSheet.ActionTitle>{action.title}</ActionSheet.ActionTitle>
          </ActionSheet.Action>
        ))}
      </ActionSheet>
      <AttachmentSheet
        showAttachmentSheet={showAttachmentSheet}
        setShowAttachmentSheet={setShowAttachmentSheet}
        setImage={attachAssets}
      />
    </>
  );
}
