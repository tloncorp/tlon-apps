import type { BridgeState, EditorBridge } from '@10play/tentap-editor';
import * as db from '@tloncorp/shared/db';
import { JSONContent, Story } from '@tloncorp/shared/urbit';
import { Button } from '@tloncorp/ui';
import { FloatingActionButton } from '@tloncorp/ui';
import { Icon } from '@tloncorp/ui';
import { ImagePickerAsset } from 'expo-image-picker';
import { memo } from 'react';
import { PropsWithChildren } from 'react';
import { SpaceTokens, styled } from 'tamagui';
import {
  ThemeTokens,
  View,
  XStack,
  YStack,
  getVariableValue,
  useTheme,
} from 'tamagui';

import { useAttachmentContext } from '../../contexts/attachment';
import { MentionPopupRef } from '../MentionPopup';
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
  storeDraft: (
    draft: JSONContent,
    draftType?: GalleryDraftType
  ) => Promise<void>;
  clearDraft: (draftType?: GalleryDraftType) => Promise<void>;
  getDraft: (draftType?: GalleryDraftType) => Promise<JSONContent | null>;
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
  onEditorStateChange?: (state: BridgeState) => void;
  onEditorContentChange?: (content?: object) => void;
  onInitialContentSet?: () => void;
  // for external access to height
  setHeight?: (height: number) => void;
  goBack?: () => void;
  shouldAutoFocus?: boolean;
  frameless?: boolean;
  ref?: React.RefObject<{
    editor: EditorBridge | null;
  }>;
}

const AttachmentButtonContainer = styled(View, {
  $sm: {
    marginBottom: '$xs',
  },
});

export const MessageInputContainer = memo(
  ({
    children,
    onPressSend,
    setShouldBlur,
    containerHeight,
    sendError,
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
    mentionRef,
    frameless = false,
  }: PropsWithChildren<{
    setShouldBlur: (shouldBlur: boolean) => void;
    onPressSend: () => void;
    containerHeight: number;
    sendError: boolean;
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
    mentionRef?: MentionPopupRef;
    frameless?: boolean;
  }>) => {
    const { canUpload } = useAttachmentContext();
    const theme = useTheme();
    const defaultBackgroundColor = getVariableValue(theme.background);
    const secondaryBackgroundColor = getVariableValue(
      theme.secondaryBackground
    );

    return (
      <YStack
        width="100%"
        backgroundColor={
          isEditing ? secondaryBackgroundColor : defaultBackgroundColor
        }
      >
        <InputMentionPopup
          containerHeight={containerHeight}
          showMentionPopup={showMentionPopup}
          mentionText={mentionText}
          groupMembers={groupMembers}
          onSelectMention={onSelectMention}
          ref={mentionRef}
        />
        {!frameless ? (
          <XStack
            paddingVertical="$s"
            paddingHorizontal="$xl"
            gap="$l"
            alignItems="flex-end"
            justifyContent="space-between"
            backgroundColor="$background"
            disableOptimization
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
              <AttachmentButtonContainer>
                <AttachmentButton setShouldBlur={setShouldBlur} />
              </AttachmentButtonContainer>
            ) : null}
            {children}
            {floatingActionButton ? (
              <View position="absolute" bottom="$l" right="$l">
                {disableSend ? null : (
                  <FloatingActionButton
                    onPress={
                      isEditing && onPressEdit ? onPressEdit : onPressSend
                    }
                    icon={
                      <Icon
                        color={sendError ? 'red' : undefined}
                        type={sendError ? 'Refresh' : 'ArrowUp'}
                      />
                    }
                  />
                )}
              </View>
            ) : (
              <View marginBottom="$xs">
                <Button
                  disabled={disableSend}
                  onPress={isEditing ? onPressEdit : onPressSend}
                  backgroundColor="unset"
                  borderColor="transparent"
                  opacity={disableSend ? 0.5 : 1}
                  testID="MessageInputSendButton"
                >
                  {isEditing ? (
                    <Icon size="$m" type="Checkmark" />
                  ) : (
                    <Icon
                      color={sendError ? '$negativeActionText' : undefined}
                      size="$m"
                      type="ArrowUp"
                    />
                  )}
                </Button>
              </View>
            )}
          </XStack>
        ) : (
          <YStack width="100%" backgroundColor="$background">
            {children}
          </YStack>
        )}
      </YStack>
    );
  }
);

MessageInputContainer.displayName = 'MessageInputContainer';
