import { ImagePickerAsset } from 'expo-image-picker';
import { useCallback, useState } from 'react';

import { SimpleActionSheet } from './ActionSheet';
import AttachmentSheet from './AttachmentSheet';
import { GalleryRoute } from './draftInputs/shared';

export default function AddGalleryPost({
  route,
  setRoute,
  onSetImage,
}: {
  route: GalleryRoute;
  setRoute: (route: GalleryRoute) => void;
  onSetImage: (assets: ImagePickerAsset[]) => void;
}) {
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);

  const actions = [
    {
      title: 'Image',
      action: () => {
        setRoute('add-attachment');
      },
    },
    {
      title: 'Text',
      action: () => {
        setRoute('text');
      },
    },
    {
      title: 'Link',
      action: () => {
        setRoute('link');
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
        open={route === 'add-post'}
        onOpenChange={() => {}}
        actions={actions}
      />
      <AttachmentSheet
        isOpen={route === 'add-attachment'}
        onOpenChange={setShowAttachmentSheet}
        onAttach={handleImageSet}
      />
    </>
  );
}
