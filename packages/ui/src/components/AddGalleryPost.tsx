import { ImagePickerAsset } from 'expo-image-picker';
import { useCallback, useMemo, useState } from 'react';

import {
  ImageAttachment,
  useMessageInputContext,
} from '../contexts/messageInput';
import { Image, View } from '../core';
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
  const { attachments, resetAttachments } = useMessageInputContext();
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);

  const attachedImage = useMemo(() => {
    return attachments.find((a): a is ImageAttachment => a.type === 'image');
  }, [attachments]);

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

  const handleSetImage = useCallback(
    (assets: ImagePickerAsset[]) => {
      resetAttachments([
        {
          type: 'image',
          file: assets[0],
        },
      ]);
    },
    [resetAttachments]
  );

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
        setImage={handleSetImage}
      />
      {attachedImage ? (
        <View flex={1}>
          <Image source={{ uri: attachedImage.file.uri }} flex={1} />
        </View>
      ) : null}
    </>
  );
}
