import { Attachment } from '@tloncorp/shared/domain';
import { ImagePickerAsset } from 'expo-image-picker';
import { useCallback } from 'react';

import { useFeatureFlag } from '../../lib/featureFlags';
import { Action, SimpleActionSheet } from './ActionSheet';
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
  const [canUploadFiles] = useFeatureFlag('fileUpload');
  const actions: Action[] = [
    {
      title: canUploadFiles ? 'Image or File' : 'Image',
      action: () => {
        setRoute('gallery');
        setTimeout(() => {
          setRoute('add-attachment');
        }, 300);
      },
      testID: 'AddGalleryPostImage',
    },
    {
      title: 'Text',
      action: () => {
        setRoute('text');
      },
      testID: 'AddGalleryPostText',
    },
    {
      title: 'Link',
      action: () => {
        setRoute('link');
      },
      testID: 'AddGalleryPostLink',
    },
  ];

  const handleAttachmentSet = useCallback(
    (assets: Attachment.UploadIntent[]) => {
      onSetImage(Attachment.UploadIntent.extractImagePickerAssets(assets));
    },
    [onSetImage]
  );

  const onClose = useCallback(
    (open: boolean) => {
      if (!open) {
        setRoute('gallery');
      }
    },
    [setRoute]
  );

  return (
    <>
      <SimpleActionSheet
        open={route === 'add-post'}
        onOpenChange={onClose}
        actions={actions}
      />
      <AttachmentSheet
        isOpen={route === 'add-attachment'}
        onOpenChange={onClose}
        onAttach={handleAttachmentSet}
        mediaType="all"
      />
    </>
  );
}
