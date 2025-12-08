import type { BridgeState, EditorBridge } from '@10play/tentap-editor';
import * as db from '@tloncorp/shared/db';
import type * as domain from '@tloncorp/shared/domain';
import { JSONContent, Story } from '@tloncorp/shared/urbit';
import { Button, FloatingActionButton, Icon } from '@tloncorp/ui';
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
import { MentionOption } from '../BareChatInput/useMentions';
import { MentionPopupRef } from '../MentionPopup';
import Notices from '../Wayfinding/Notices';
import { GalleryDraftType } from '../draftInputs/shared';
import AttachmentButton from './AttachmentButton';
import InputMentionPopup from './InputMentionPopup';

export interface MessageInputProps {
  shouldBlur: boolean;
  setShouldBlur: (shouldBlur: boolean) => void;
  sendPostFromDraft: (draft: domain.PostDataDraft) => Promise<void>;
  sendPost: (
    content: Story,
    channelId: string,
    metadata?: db.PostMetadata
  ) => Promise<void>;
  channelId: string;
  groupId?: string | null;
  groupMembers: db.ChatMember[];
  groupRoles: db.GroupRole[];
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
  showWayfindingTooltip?: boolean;
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
    isMentionModeActive = false,
    showAttachmentButton = true,
    floatingActionButton = false,
    showWayfindingTooltip = false,
    disableSend = false,
    isSending = false,
    mentionText,
    mentionOptions,
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
    isMentionModeActive?: boolean;
    showAttachmentButton?: boolean;
    floatingActionButton?: boolean;
    showWayfindingTooltip?: boolean;
    disableSend?: boolean;
    isSending?: boolean;
    mentionText?: string;
    mentionOptions: MentionOption[];
    onSelectMention: (option: MentionOption) => void;
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
          isMentionModeActive={isMentionModeActive}
          mentionText={mentionText}
          options={mentionOptions}
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
                  fill="ghost"
                  size="small"
                  leadingIcon="ChevronLeft"
                  onPress={goBack}
                />
              </View>
            ) : null}

            {isEditing ? (
              <View marginBottom="$2xs">
                <Button
                  fill="ghost"
                  size="small"
                  leadingIcon="Close"
                  onPress={cancelEditing}
                />
              </View>
            ) : null}
            {canUpload && showAttachmentButton ? (
              <AttachmentButtonContainer>
                <AttachmentButton
                  setShouldBlur={setShouldBlur}
                  mediaType="all"
                />
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
                {showWayfindingTooltip && <Notices.ChatInputTooltip />}
                <Button
                  fill="ghost"
                  size="small"
                  disabled={disableSend}
                  loading={isSending}
                  onPress={isEditing ? onPressEdit : onPressSend}
                  testID="MessageInputSendButton"
                  leadingIcon={
                    isEditing ? (
                      'Checkmark'
                    ) : (
                      <Icon
                        color={sendError ? '$negativeActionText' : undefined}
                        type="ArrowUp"
                      />
                    )
                  }
                />
              </View>
            )}
          </XStack>
        ) : (
          // Note: This **must** be an XStack (not a YStack, View, or Stack), otherwise the WebView in MessageInput will not
          // be interactive on Android.
          <XStack width="100%" backgroundColor="$background">
            {children}
          </XStack>
        )}
      </YStack>
    );
  }
);

MessageInputContainer.displayName = 'MessageInputContainer';
