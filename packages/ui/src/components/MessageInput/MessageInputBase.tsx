import { EditorBridge } from '@10play/tentap-editor';
import { UploadInfo, UploadedFile } from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import { JSONContent, Story } from '@tloncorp/shared/dist/urbit';
import { PropsWithChildren, useMemo } from 'react';
import { SpaceTokens } from 'tamagui';

import { ArrowUp, Checkmark, Close } from '../../assets/icons';
import { ThemeTokens, View, XStack, YStack } from '../../core';
import FloatingActionButton from '../FloatingActionButton';
import { Icon } from '../Icon';
import { IconButton } from '../IconButton';
import AttachmentButton from './AttachmentButton';
import InputMentionPopup from './InputMentionPopup';
import ReferencePreview from './ReferencePreview';

export interface MessageInputProps {
  shouldBlur: boolean;
  setShouldBlur: (shouldBlur: boolean) => void;
  send: (content: Story, channelId: string, metadata?: db.PostMetadata) => void;
  channelId: string;
  uploadInfo?: UploadInfo;
  groupMembers: db.ChatMember[];
  storeDraft: (draft: JSONContent) => void;
  clearDraft: () => void;
  getDraft: () => Promise<JSONContent>;
  editingPost?: db.Post;
  setEditingPost?: (post: db.Post | undefined) => void;
  editPost?: (post: db.Post, content: Story) => void;
  setShowBigInput?: (showBigInput: boolean) => void;
  showAttachmentButton?: boolean;
  floatingActionButton?: boolean;
  paddingHorizontal?: SpaceTokens;
  backgroundColor?: ThemeTokens;
  placeholder?: string;
  bigInput?: boolean;
  title?: string;
  image?: UploadedFile;
  showToolbar?: boolean;
  channelType?: db.ChannelType;
  ref?: React.RefObject<{
    editor: EditorBridge | null;
    setEditor: (editor: EditorBridge) => void;
  }>;
}

export const MessageInputContainer = ({
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
  titleIsEmpty,
  channelType,
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
  titleIsEmpty: boolean;
  channelType?: db.ChannelType;
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
            {editorIsEmpty ||
            (channelType === 'notebook' && titleIsEmpty) ? null : (
              <FloatingActionButton
                onPress={isEditing && onPressEdit ? onPressEdit : onPressSend}
                label={isEditing ? 'Save' : 'Send'}
                icon={
                  isEditing ? (
                    <Icon type="Checkmark" />
                  ) : (
                    <Icon type="ArrowUp" />
                  )
                }
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
