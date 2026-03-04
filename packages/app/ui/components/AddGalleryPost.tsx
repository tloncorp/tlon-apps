import { Attachment } from '@tloncorp/shared/domain';
import { useCallback } from 'react';

import { Action, SimpleActionSheet } from './ActionSheet';
import AttachmentSheet from './AttachmentSheet';
import { GalleryRoute } from './draftInputs/shared';

export default function AddGalleryPost({
  route,
  setRoute,
  onSetMedia,
}: {
  route: GalleryRoute;
  setRoute: (route: GalleryRoute) => void;
  onSetMedia: (assets: Attachment.UploadIntent[]) => void;
}) {
  const actions: Action[] = [
    {
      title: 'Upload Media',
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
      onSetMedia(assets);
    },
    [onSetMedia]
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
        allowVideoInMediaPicker={false}
        mediaType="all"
      />
    </>
  );
}
