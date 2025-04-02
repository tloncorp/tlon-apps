import { ImagePickerAsset } from 'expo-image-picker';
import { useCallback, useState } from 'react';

import { SimpleActionSheet } from './ActionSheet';
import AttachmentSheet from './AttachmentSheet';

export default function AddGalleryPost({
  showAddGalleryPost,
  setShowAddGalleryPost,
  setShowGalleryInput,
  onSetImage,
}: {
  showAddGalleryPost: boolean;
  setShowAddGalleryPost: (show: boolean) => void;
  setShowGalleryInput: (show: boolean) => void;
  onSetImage: (assets: ImagePickerAsset[]) => void;
}) {
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);

  const actions = [
    {
      title: 'Image',
      action: () => {
        setShowAddGalleryPost(false);
        setShowAttachmentSheet(true);
      },
    },
    {
      title: 'Text',
      action: () => {
        setShowAddGalleryPost(false);
        setShowGalleryInput(true);
      },
    },
  ];

  const handleImageSet = useCallback(
    (assets: ImagePickerAsset[]) => {
      onSetImage(assets);
    },
    [onSetImage]
  );

  return (
    <>
      <SimpleActionSheet
        open={showAddGalleryPost}
        onOpenChange={setShowAddGalleryPost}
        actions={actions}
      />
      <AttachmentSheet
        isOpen={showAttachmentSheet}
        onOpenChange={setShowAttachmentSheet}
        onAttach={handleImageSet}
      />
    </>
  );
}
