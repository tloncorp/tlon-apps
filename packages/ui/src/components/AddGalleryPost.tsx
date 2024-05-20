import { useState } from 'react';

import { ActionSheet } from './ActionSheet';
import AttachmentSheet from './AttachmentSheet';

export default function AddGalleryPost({
  showAddGalleryPost,
  setShowAddGalleryPost,
  setShowGalleryInput,
  setImage,
}: {
  showAddGalleryPost: boolean;
  setShowAddGalleryPost: (show: boolean) => void;
  setShowGalleryInput: (show: boolean) => void;
  setImage: (uri: string | null) => void;
}) {
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
        setImage={setImage}
      />
    </>
  );
}
