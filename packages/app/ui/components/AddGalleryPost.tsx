import { Attachment } from '@tloncorp/shared/domain';
import { useCallback } from 'react';
import { Alert } from 'react-native';
import { isWeb } from 'tamagui';

import { normalizeUploadIntents, pickFile } from '../../utils/filepicker';
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
  const openFilePicker = useCallback(async () => {
    const uploadIntents = await pickFile();
    const { uploadIntents: normalizedUploadIntents, errorMessage } =
      await normalizeUploadIntents(uploadIntents);

    if (errorMessage) {
      Alert.alert('Unable to attach', errorMessage);
    }

    if (normalizedUploadIntents.length > 0) {
      onSetMedia(normalizedUploadIntents);
    }
  }, [onSetMedia]);

  const actions: Action[] = [
    {
      title: 'Media or File',
      action: () => {
        if (isWeb) {
          void openFilePicker();
        } else {
          setRoute('gallery');
          setTimeout(() => {
            setRoute('add-attachment');
          }, 300);
        }
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
