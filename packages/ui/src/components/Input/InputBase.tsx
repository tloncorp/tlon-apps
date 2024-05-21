import { UploadInfo } from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import { JSONContent, Story } from '@tloncorp/shared/dist/urbit';
import { PropsWithChildren, useMemo } from 'react';

import { ArrowUp, Checkmark, Close } from '../../assets/icons';
import { View, XStack, YStack } from '../../core';
import FloatingActionButton from '../FloatingActionButton';
import { IconButton } from '../IconButton';
import InputMentionPopup from '../Input/InputMentionPopup';
import ReferencePreview from '../Input/ReferencePreview';
import AttachmentButton from './AttachmentButton';

export interface InputProps {
  shouldBlur: boolean;
  setShouldBlur: (shouldBlur: boolean) => void;
  send: (content: Story, channelId: string) => void;
  channelId: string;
  uploadInfo?: UploadInfo;
  groupMembers: db.ChatMember[];
  storeDraft: (draft: JSONContent) => void;
  clearDraft: () => void;
  getDraft: () => Promise<JSONContent>;
  editingPost?: db.Post;
  setEditingPost?: (post: db.Post | undefined) => void;
  editPost?: (post: db.Post, content: Story) => void;
  setShowGalleryInput?: (showGalleryInput: boolean) => void;
}

export const InputContainer = ({
  children,
  onPressSend,
  uploadInfo,
  containerHeight,
  showMentionPopup = false,
  showAttachmentButton = true,
  floatingActionButton = false,
  mentionText,
  groupMembers,
  onSelectMention,
  isEditing = false,
  cancelEditing,
  onPressEdit,
  editorIsEmpty,
}: PropsWithChildren<{
  onPressSend: () => void;
  uploadInfo?: UploadInfo;
  containerHeight: number;
  showMentionPopup?: boolean;
  showAttachmentButton?: boolean;
  floatingActionButton?: boolean;
  mentionText?: string;
  groupMembers: db.ChatMember[];
  onSelectMention: (contact: db.Contact) => void;
  isEditing?: boolean;
  cancelEditing?: () => void;
  onPressEdit?: () => void;
  editorIsEmpty: boolean;
}>) => {
  const hasUploadedImage = useMemo(
    () => !!(uploadInfo?.uploadedImage && uploadInfo.uploadedImage.url !== ''),
    [uploadInfo]
  );
  const uploadIsLoading = useMemo(() => uploadInfo?.uploading, [uploadInfo]);
  const sendIconColor = useMemo(
    () => (uploadIsLoading ? '$secondaryText' : '$primaryText'),
    [uploadIsLoading]
  );

  return (
    <YStack width="100%">
      <ReferencePreview containerHeight={containerHeight} />
      <InputMentionPopup
        containerHeight={containerHeight}
        showMentionPopup={showMentionPopup}
        mentionText={mentionText}
        groupMembers={groupMembers}
        onSelectMention={onSelectMention}
      />
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
        {hasUploadedImage ? null : uploadInfo?.canUpload &&
          showAttachmentButton ? (
          <View paddingBottom="$m">
            <AttachmentButton uploadInfo={uploadInfo} />
          </View>
        ) : null}
        {children}
        {floatingActionButton ? (
          <View position="absolute" bottom="$l" right="$l">
            {editorIsEmpty ? null : (
              <FloatingActionButton
                onPress={isEditing && onPressEdit ? onPressEdit : onPressSend}
                icon={isEditing ? <Checkmark /> : <ArrowUp />}
              />
            )}
          </View>
        ) : (
          <View paddingBottom="$m">
            {editorIsEmpty ? null : (
              <IconButton
                color={sendIconColor}
                disabled={uploadIsLoading}
                onPress={isEditing && onPressEdit ? onPressEdit : onPressSend}
              >
                {isEditing ? <Checkmark /> : <ArrowUp />}
              </IconButton>
            )}
          </View>
        )}
      </XStack>
    </YStack>
  );
};
