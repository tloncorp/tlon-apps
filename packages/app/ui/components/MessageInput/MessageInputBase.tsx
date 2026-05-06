import type { BridgeState, EditorBridge } from '@10play/tentap-editor';
import { JSONContent } from '@tloncorp/api/urbit';
import * as db from '@tloncorp/shared/db';
import type * as domain from '@tloncorp/shared/domain';
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
import { type MentionOption } from '../BareChatInput/useMentions';
import { type SlashCommandOption } from '../BareChatInput/useSlashCommands';
import { type MentionPopupRef } from '../MentionPopup';
import { type SlashCommandPopupRef } from '../SlashCommandPopup';
import Notices from '../Wayfinding/Notices';
import { GalleryDraftType } from '../draftInputs/shared';
import AttachmentButton from './AttachmentButton';
import InputMentionPopup from './InputMentionPopup';
import InputSlashCommandPopup from './InputSlashCommandPopup';

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
    isSlashCommandModeActive = false,
    showAttachmentButton = true,
    floatingActionButton = false,
    showWayfindingTooltip = false,
    showBotMentionTooltip = false,
    disableSend = false,
    isSending = false,
    mentionText,
    mentionOptions,
    slashCommandOptions = [],
    onSelectMention,
    onSelectSlashCommand,
    isEditing = false,
    cancelEditing,
    onPressEdit,
    goBack,
    mentionRef,
    slashCommandRef,
    frameless = false,
  }: PropsWithChildren<{
    setShouldBlur: (shouldBlur: boolean) => void;
    onPressSend: () => void;
    containerHeight: number;
    sendError: boolean;
    isMentionModeActive?: boolean;
    isSlashCommandModeActive?: boolean;
    showAttachmentButton?: boolean;
    floatingActionButton?: boolean;
    showWayfindingTooltip?: boolean;
    showBotMentionTooltip?: boolean;
    disableSend?: boolean;
    isSending?: boolean;
    mentionText?: string;
    mentionOptions: MentionOption[];
    slashCommandOptions?: SlashCommandOption[];
    onSelectMention: (option: MentionOption) => void;
    onSelectSlashCommand?: (option: SlashCommandOption) => void;
    isEditing?: boolean;
    cancelEditing?: () => void;
    onPressEdit?: () => void;
    goBack?: () => void;
    mentionRef?: MentionPopupRef;
    slashCommandRef?: SlashCommandPopupRef;
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
        {onSelectSlashCommand ? (
          <InputSlashCommandPopup
            containerHeight={containerHeight}
            isSlashCommandModeActive={isSlashCommandModeActive}
            options={slashCommandOptions}
            onSelectSlashCommand={onSelectSlashCommand}
            ref={slashCommandRef}
          />
        ) : null}
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
          <XStack width="100%" backgroundColor="$background">
            {children}
          </XStack>
        )}
      </YStack>
    );
  }
);

MessageInputContainer.displayName = 'MessageInputContainer';
