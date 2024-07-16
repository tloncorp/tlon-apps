import { EditorBridge } from '@10play/tentap-editor';
import * as db from '@tloncorp/shared/dist/db';
import { JSONContent, Story } from '@tloncorp/shared/dist/urbit';
import { ImagePickerAsset } from 'expo-image-picker';
import { PropsWithChildren } from 'react';
import { SpaceTokens } from 'tamagui';

import { ArrowUp, Checkmark, ChevronLeft, Close } from '../../assets/icons';
import { ThemeTokens, View, XStack, YStack } from '../../core';
import { FloatingActionButton } from '../FloatingActionButton';
import { Icon } from '../Icon';
import { IconButton } from '../IconButton';
import AttachmentButton from './AttachmentButton';
import InputMentionPopup from './InputMentionPopup';

export interface MessageInputProps {
  shouldBlur: boolean;
  setShouldBlur: (shouldBlur: boolean) => void;
  send: (
    content: Story,
    channelId: string,
    metadata?: db.PostMetadata
  ) => Promise<void>;
  channelId: string;
  groupMembers: db.ChatMember[];
  storeDraft: (draft: JSONContent) => void;
  clearDraft: () => void;
  getDraft: () => Promise<JSONContent>;
  editingPost?: db.Post;
  setEditingPost?: (post: db.Post | undefined) => void;
  editPost?: (
    post: db.Post,
    content: Story,
    parentId?: string
  ) => Promise<void>;
  setShowBigInput?: (showBigInput: boolean) => void;
  showAttachmentButton?: boolean;
  floatingActionButton?: boolean;
  paddingHorizontal?: SpaceTokens;
  backgroundColor?: ThemeTokens;
  placeholder?: string;
  bigInput?: boolean;
  title?: string;
  image?: ImagePickerAsset;
  showInlineAttachments?: boolean;
  showToolbar?: boolean;
  channelType: db.ChannelType;
  initialHeight?: number;
  // for external access to height
  setHeight?: (height: number) => void;
  goBack?: () => void;
  ref?: React.RefObject<{
    editor: EditorBridge | null;
    setEditor: (editor: EditorBridge) => void;
  }>;
}

export const MessageInputContainer = ({
  children,
  onPressSend,
  setShouldBlur,
  containerHeight,
  showMentionPopup = false,
  showAttachmentButton = true,
  floatingActionButton = false,
  disableSend = false,
  mentionText,
  groupMembers,
  onSelectMention,
  isEditing = false,
  cancelEditing,
  onPressEdit,
  goBack,
}: PropsWithChildren<{
  setShouldBlur: (shouldBlur: boolean) => void;
  onPressSend: () => void;
  containerHeight: number;
  showMentionPopup?: boolean;
  showAttachmentButton?: boolean;
  floatingActionButton?: boolean;
  disableSend?: boolean;
  mentionText?: string;
  groupMembers: db.ChatMember[];
  onSelectMention: (contact: db.Contact) => void;
  isEditing?: boolean;
  cancelEditing?: () => void;
  onPressEdit?: () => void;
  goBack?: () => void;
}>) => {
  return (
    <YStack width="100%">
      <InputMentionPopup
        containerHeight={containerHeight}
        showMentionPopup={showMentionPopup}
        mentionText={mentionText}
        groupMembers={groupMembers}
        onSelectMention={onSelectMention}
      />
      <XStack
        paddingHorizontal="$m"
        paddingBottom="$s"
        gap="$l"
        alignItems="flex-end"
        justifyContent="space-between"
      >
        {goBack ? (
          <View paddingBottom="$xs">
            <IconButton backgroundColor="unset" onPress={goBack}>
              <ChevronLeft />
            </IconButton>
          </View>
        ) : null}
        {isEditing ? (
          <View paddingBottom="$xs">
            <IconButton backgroundColor="unset" onPress={cancelEditing}>
              <Close />
            </IconButton>
          </View>
        ) : null}
        {showAttachmentButton ? (
          <View paddingBottom="$xs">
            <AttachmentButton setShouldBlur={setShouldBlur} />
          </View>
        ) : null}
        {children}
        {floatingActionButton ? (
          <View position="absolute" bottom="$l" right="$l">
            {disableSend ? null : (
              <FloatingActionButton
                onPress={isEditing && onPressEdit ? onPressEdit : onPressSend}
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
          <View paddingBottom="$xs">
            {disableSend ? null : (
              <IconButton
                color={'$primaryText'}
                onPress={isEditing && onPressEdit ? onPressEdit : onPressSend}
                backgroundColor="unset"
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
