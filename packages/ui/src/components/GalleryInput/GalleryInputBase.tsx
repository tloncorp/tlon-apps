import { Upload } from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import { JSONContent, Story } from '@tloncorp/shared/dist/urbit';
import { PropsWithChildren, useMemo } from 'react';

import { ArrowUp, Checkmark, Close } from '../../assets/icons';
import { useReferences } from '../../contexts/references';
import { View, XStack, YStack } from '../../core';
import AttachmentButton from '../AttachmentButton';
import ContentReference from '../ContentReference';
import { IconButton } from '../IconButton';
import MentionPopup from '../MentionPopup';

export interface GalleryInputProps {
  shouldBlur: boolean;
  setShouldBlur: (shouldBlur: boolean) => void;
  send: (content: Story, channelId: string) => void;
  channelId: string;
  setImageAttachment: (image: string | null) => void;
  uploadedImage?: Upload | null;
  canUpload?: boolean;
  groupMembers: db.ChatMember[];
  storeDraft: (draft: JSONContent) => void;
  clearDraft: () => void;
  getDraft: () => Promise<JSONContent>;
  editingPost?: db.Post;
  setEditingPost?: (post: db.Post | undefined) => void;
  editPost?: (post: db.Post, content: Story) => void;
  setShowGalleryInput: (showGalleryInput: boolean) => void;
}

export const GalleryInputContainer = ({
  children,
  onPressSend,
  setImageAttachment,
  uploadedImage,
  canUpload,
  containerHeight,
  showMentionPopup = false,
  mentionText,
  groupMembers,
  onSelectMention,
  isEditing = false,
  cancelEditing,
  onPressEdit,
  editorIsEmpty,
}: PropsWithChildren<{
  onPressSend?: () => void;
  setImageAttachment: (image: string | null) => void;
  uploadedImage?: Upload | null;
  canUpload?: boolean;
  containerHeight: number;
  showMentionPopup?: boolean;
  mentionText?: string;
  groupMembers: db.ChatMember[];
  onSelectMention: (contact: db.Contact) => void;
  isEditing?: boolean;
  cancelEditing?: () => void;
  onPressEdit?: () => void;
  editorIsEmpty: boolean;
}>) => {
  const { references, setReferences } = useReferences();
  const hasUploadedImage = useMemo(
    () => !!(uploadedImage && uploadedImage.url !== ''),
    [uploadedImage]
  );
  const uploadIsLoading = useMemo(
    () => uploadedImage?.status === 'loading',
    [uploadedImage]
  );
  const sendIconColor = useMemo(
    () => (uploadIsLoading ? '$secondaryText' : '$primaryText'),
    [uploadIsLoading]
  );

  return (
    <YStack position="relative" width="100%" height="100%">
      {Object.keys(references).length ? (
        <YStack
          gap="$s"
          width="100%"
          position="absolute"
          bottom={containerHeight + 4}
          zIndex={10}
          backgroundColor="$background"
        >
          {Object.keys(references).map((ref) =>
            references[ref] !== null ? (
              <XStack
                left={15}
                position="relative"
                key={ref}
                width="100%"
                height="auto"
              >
                <ContentReference
                  asAttachment
                  reference={references[ref]!}
                  key={ref}
                />
                <View position="absolute" top={4} right={36}>
                  <IconButton
                    onPress={() => {
                      setReferences({ ...references, [ref]: null });
                    }}
                    color="$primaryText"
                  >
                    <Close />
                  </IconButton>
                </View>
              </XStack>
            ) : null
          )}
        </YStack>
      ) : null}
      {showMentionPopup ? (
        <YStack position="absolute" bottom={containerHeight + 24} zIndex={15}>
          <View position="relative" top={0} left={8}>
            <MentionPopup
              onPress={onSelectMention}
              matchText={mentionText}
              groupMembers={groupMembers}
            />
          </View>
        </YStack>
      ) : null}
      <XStack
        paddingHorizontal="$m"
        paddingVertical="$s"
        gap="$l"
        alignItems="flex-end"
        justifyContent="space-between"
      >
        {isEditing ? (
          <View paddingBottom="$m">
            <IconButton onPress={cancelEditing}>
              <Close />
            </IconButton>
          </View>
        ) : null}
        {hasUploadedImage ? null : canUpload ? (
          <View paddingBottom="$m">
            <AttachmentButton
              uploadedImage={uploadedImage}
              setImage={setImageAttachment}
            />
          </View>
        ) : null}
        {children}
      </XStack>
      <View position="absolute" bottom="$l" right="$l">
        {editorIsEmpty ? null : (
          <IconButton
            backgroundColor="$primaryText"
            backgroundColorOnPress="$tertiaryText"
            color="$background"
            radius="$xl"
            onPress={isEditing && onPressEdit ? onPressEdit : onPressSend}
          >
            {isEditing ? <Checkmark /> : <ArrowUp />}
          </IconButton>
        )}
      </View>
    </YStack>
  );
};
