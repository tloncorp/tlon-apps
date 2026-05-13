import { Attachment } from '@tloncorp/shared/domain';
import { useCallback } from 'react';
import { isWeb } from 'tamagui';

import { pickFile } from '../../utils/filepicker';
import { useAttachmentContext } from '../contexts/attachment';
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
  const { attachAssets } = useAttachmentContext();

  const openWebFilePicker = useCallback(async () => {
    setRoute('gallery');
    const { uploadIntents } = await pickFile();
    if (uploadIntents.length > 0) {
      attachAssets(uploadIntents);
      onSetMedia(uploadIntents);
    }
  }, [setRoute, attachAssets, onSetMedia]);

  const actions: Action[] = [
    {
      title: 'Media or File',
      action: isWeb
        ? openWebFilePicker
        : () => {
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
        modal
      />
      {/* On web, "Media or File" opens the system file picker directly,
          so AttachmentSheet is only needed on mobile. */}
      {!isWeb && (
        <AttachmentSheet
          isOpen={route === 'add-attachment'}
          onOpenChange={onClose}
          onAttach={handleAttachmentSet}
          mediaType="all"
        />
      )}
    </>
  );
}
