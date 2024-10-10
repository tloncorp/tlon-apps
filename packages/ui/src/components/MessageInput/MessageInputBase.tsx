import type { EditorBridge } from '@10play/tentap-editor';
import { useCurrentSession } from '@tloncorp/shared/dist';
import * as db from '@tloncorp/shared/dist/db';
import { JSONContent, Story } from '@tloncorp/shared/dist/urbit';
import { ImagePickerAsset } from 'expo-image-picker';
import { memo } from 'react';
import { PropsWithChildren, useMemo } from 'react';
import { SpaceTokens } from 'tamagui';
import { ThemeTokens, View, XStack, YStack } from 'tamagui';

import { useAttachmentContext } from '../../contexts/attachment';
import { Button } from '../Button';
import { FloatingActionButton } from '../FloatingActionButton';
import { Icon } from '../Icon';
import { LoadingSpinner } from '../LoadingSpinner';
import { GalleryDraftType } from '../draftInputs/shared';
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
  storeDraft: (draft: JSONContent, draftType?: GalleryDraftType) => void;
  clearDraft: (draftType?: GalleryDraftType) => void;
  getDraft: (draftType?: GalleryDraftType) => Promise<JSONContent>;
  editingPost?: db.Post;
  setEditingPost?: (post: db.Post | undefined) => void;
  editPost?: (
    post: db.Post,
    content: Story,
    parentId?: string,
    metadata?: db.PostMetadata
  ) => Promise<void>;
  setShowBigInput?: (showBigInput: boolean) => void;
  showAttachmentButton?: boolean;
  floatingActionButton?: boolean;
  paddingHorizontal?: SpaceTokens;
  backgroundColor?: ThemeTokens;
  placeholder?: string;
  bigInput?: boolean;
  draftType?: GalleryDraftType;
  title?: string;
  image?: ImagePickerAsset;
  showInlineAttachments?: boolean;
  showToolbar?: boolean;
  channelType: db.ChannelType;
  initialHeight?: number;
  onSend?: () => void;
  // for external access to height
  setHeight?: (height: number) => void;
  goBack?: () => void;
  ref?: React.RefObject<{
    editor: EditorBridge | null;
    setEditor: (editor: EditorBridge) => void;
  }>;
}

export const MessageInputContainer = memo(
  ({
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
    isSending,
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
    isSending?: boolean;
    cancelEditing?: () => void;
    onPressEdit?: () => void;
    goBack?: () => void;
  }>) => {
    const currentSession = useCurrentSession();
    const isDisconnected = useMemo(
      () => !currentSession || currentSession.isReconnecting === true,
      [currentSession]
    );
    const { canUpload } = useAttachmentContext();

    return (
      <YStack
        width="100%"
        backgroundColor={isEditing ? '$secondaryBackground' : '$background'}
      >
        <InputMentionPopup
          containerHeight={containerHeight}
          showMentionPopup={showMentionPopup}
          mentionText={mentionText}
          groupMembers={groupMembers}
          onSelectMention={onSelectMention}
        />
        <XStack
          paddingVertical="$s"
          paddingHorizontal="$xl"
          gap="$l"
          alignItems="flex-end"
          justifyContent="space-between"
        >
          {goBack ? (
            <View paddingBottom="$xs">
              <Button
                backgroundColor="unset"
                borderColor="transparent"
                onPress={goBack}
              >
                <Icon type="ChevronLeft" />
              </Button>
            </View>
          ) : null}

          {isEditing ? (
            // using $2xs instead of $xs to match the padding of the attachment button
            // might need to update the close icon?
            <View marginBottom="$2xs">
              <Button
                backgroundColor="unset"
                borderColor="transparent"
                onPress={cancelEditing}
              >
                <Icon size="$m" type="Close" />
              </Button>
            </View>
          ) : null}
          {canUpload && showAttachmentButton ? (
            <View marginBottom="$xs">
              <AttachmentButton setShouldBlur={setShouldBlur} />
            </View>
          ) : null}
          {children}
          {floatingActionButton ? (
            <View position="absolute" bottom="$l" right="$l">
              {disableSend ? null : (
                <FloatingActionButton
                  onPress={isEditing && onPressEdit ? onPressEdit : onPressSend}
                  icon={<Icon type="ArrowUp" />}
                />
              )}
            </View>
          ) : (
            <View marginBottom="$xs">
              <Button
                disabled={disableSend || isSending || isDisconnected}
                onPress={isEditing ? onPressEdit : onPressSend}
                backgroundColor="unset"
                borderColor="transparent"
                opacity={disableSend || isDisconnected ? 0.5 : 1}
              >
                {isSending ? (
                  <View width="$2xl" height="$2xl">
                    <LoadingSpinner size="small" color="$secondaryText" />
                  </View>
                ) : isEditing ? (
                  <Icon size="$m" type="Checkmark" />
                ) : (
                  <Icon size="$m" type="ArrowUp" />
                )}
              </Button>
            </View>
          )}
        </XStack>
      </YStack>
    );
  }
);

MessageInputContainer.displayName = 'MessageInputContainer';
