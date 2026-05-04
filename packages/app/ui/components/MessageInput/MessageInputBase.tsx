import type { BridgeState, EditorBridge } from '@10play/tentap-editor';
import { JSONContent, Story } from '@tloncorp/api/urbit';
import * as db from '@tloncorp/shared/db';
import type * as domain from '@tloncorp/shared/domain';
import { Button, FloatingActionButton, Icon } from '@tloncorp/ui';
import { ImagePickerAsset } from 'expo-image-picker';
import { memo, useState } from 'react';
import { PropsWithChildren } from 'react';
import { LayoutChangeEvent } from 'react-native';
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
import { GalleryDraftType, useDraftInputContext } from '../draftInputs/shared';
import AttachmentButton from './AttachmentButton';
import InputMentionPopup from './InputMentionPopup';

export interface MessageInputProps {
  shouldBlur: boolean;
  setShouldBlur: (shouldBlur: boolean) => void;
  sendPostFromDraft: (draft: domain.PostDataDraft) => Promise<void>;
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
  setShowBigInput?: (showBigInput: boolean) => void;
  showAttachmentButton?: boolean;
  showWayfindingTooltip?: boolean;
  showBotMentionTooltip?: boolean;
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
    showBotMentionTooltip = false,
    disableSend = false,
    isSending = false,
    mentionText,
    mentionOptions,
    onSelectMention,
    onDismissMentions,
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
    showBotMentionTooltip?: boolean;
    disableSend?: boolean;
    isSending?: boolean;
    mentionText?: string;
    mentionOptions: MentionOption[];
    onSelectMention: (option: MentionOption) => void;
    onDismissMentions?: () => void;
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
    // Track the real input-bar height so the mention backdrop (mobile
    // tap-outside dismiss area) stops above the actual composer. The popup
    // itself stays anchored to the static containerHeight so it remains
    // accessible even if the user writes a huge multi-line draft.
    const [measuredInputHeight, setMeasuredInputHeight] =
      useState(containerHeight);
    const handleInputLayout = (e: LayoutChangeEvent) => {
      setMeasuredInputHeight(e.nativeEvent.layout.height);
    };

    return (
      <YStack
        width="100%"
        backgroundColor={
          isEditing ? secondaryBackgroundColor : defaultBackgroundColor
        }
      >
        <InputMentionPopup
          containerHeight={containerHeight}
          inputBarHeight={measuredInputHeight}
          isMentionModeActive={isMentionModeActive}
          mentionText={mentionText}
          options={mentionOptions}
          onSelectMention={onSelectMention}
          onDismiss={onDismissMentions}
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
            onLayout={handleInputLayout}
          >
            {goBack ? (
              <View paddingBottom="$xs">
                <Button
                  preset="secondary"
                  icon="ChevronLeft"
                  onPress={goBack}
                />
              </View>
            ) : null}

            {isEditing ? (
              <View marginBottom="$2xs">
                <Button
                  preset="secondary"
                  icon="Close"
                  onPress={cancelEditing}
                />
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
                {showWayfindingTooltip && <Notices.ChatInputTooltip />}
                {showBotMentionTooltip && <Notices.BotMentionTooltip />}
                <Button
                  preset="secondary"
                  disabled={disableSend}
                  loading={isSending}
                  testID="MessageInputSendButton"
                  onPress={isEditing ? onPressEdit : onPressSend}
                  icon={
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
          <XStack
            width="100%"
            backgroundColor="$background"
            onLayout={handleInputLayout}
          >
            {children}
          </XStack>
        )}
      </YStack>
    );
  }
);

MessageInputContainer.displayName = 'MessageInputContainer';
