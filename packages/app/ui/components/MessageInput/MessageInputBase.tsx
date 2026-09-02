import type { BridgeState, EditorBridge } from '@10play/tentap-editor';
import { JSONContent } from '@tloncorp/api/urbit';
import type { PostSendOptions } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import type * as domain from '@tloncorp/shared/domain';
import { Button, FloatingActionButton, Icon } from '@tloncorp/ui';
import { ImagePickerAsset } from 'expo-image-picker';
import type { ReactNode } from 'react';
import { ComponentProps, PropsWithChildren, memo, useState } from 'react';
import { LayoutChangeEvent, Platform, StyleSheet } from 'react-native';
import { SpaceTokens } from 'tamagui';
import {
  ThemeTokens,
  View,
  XStack,
  YStack,
  getVariableValue,
  useTheme,
} from 'tamagui';

import { useAttachmentContext } from '../../contexts/attachment';
import { useConversationScrollToBottomControl } from '../../contexts/scroll';
import { MentionOption } from '../BareChatInput/useMentions';
import {
  type SlashCommandManifest,
  type SlashCommandOption,
} from '../BareChatInput/useSlashCommands';
import {
  GlassSurface,
  GlassSurfaceGroup,
  supportsLiquidGlass,
} from '../GlassSurface';
import { MentionPopupRef } from '../MentionPopup';
import { type SlashCommandPopupRef } from '../SlashCommandPopup';
import Notices from '../Wayfinding/Notices';
import {
  ConversationScrollToBottomButton,
  floatingScrollControlClearance,
  floatingChromeMetrics as metrics,
} from '../conversationScrollChrome';
import { GalleryDraftType } from '../draftInputs/shared';
import AttachmentButton from './AttachmentButton';
import InputMentionPopup from './InputMentionPopup';
import InputSlashCommandPopup from './InputSlashCommandPopup';

export interface MessageInputProps {
  shouldBlur: boolean;
  setShouldBlur: (shouldBlur: boolean) => void;
  sendPostFromDraft: (
    draft: domain.PostDataDraft,
    options?: PostSendOptions
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
  setShowBigInput?: (showBigInput: boolean) => void;
  showAttachmentButton?: boolean;
  showWayfindingTooltip?: boolean;
  showBotMentionTooltip?: boolean;
  // When present, the input offers bot slash commands. Consumers that omit it
  // (e.g. threads via PostScreenView) get no slash commands.
  slashCommandManifest?: SlashCommandManifest | null;
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
    onDismissMentions,
    onDismissSlashCommands,
    isEditing = false,
    cancelEditing,
    onPressEdit,
    goBack,
    mentionRef,
    slashCommandRef,
    frameless = false,
    contentBackgroundColor,
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
    onDismissMentions?: () => void;
    onDismissSlashCommands?: () => void;
    isEditing?: boolean;
    cancelEditing?: () => void;
    onPressEdit?: () => void;
    goBack?: () => void;
    mentionRef?: MentionPopupRef;
    slashCommandRef?: SlashCommandPopupRef;
    frameless?: boolean;
    contentBackgroundColor?: ThemeTokens;
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
    const handleInputHeightChange = (height: number) => {
      setMeasuredInputHeight(height);
    };

    return (
      <MessageInputChromeRoot
        isEditing={isEditing}
        backgroundColor={defaultBackgroundColor}
        editingBackgroundColor={secondaryBackgroundColor}
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
        {onSelectSlashCommand ? (
          <InputSlashCommandPopup
            containerHeight={containerHeight}
            inputBarHeight={measuredInputHeight}
            isSlashCommandModeActive={isSlashCommandModeActive}
            options={slashCommandOptions}
            onSelectSlashCommand={onSelectSlashCommand}
            onDismiss={onDismissSlashCommands}
            ref={slashCommandRef}
          />
        ) : null}
        {!frameless ? (
          <MessageInputChromeRow onHeightChange={handleInputHeightChange}>
            {goBack ? (
              <MessageInputChromeAction>
                <MessageInputChromeButton
                  preset="secondary"
                  icon="ChevronLeft"
                  onPress={goBack}
                />
              </MessageInputChromeAction>
            ) : null}

            {isEditing ? (
              <MessageInputChromeAction>
                <MessageInputChromeButton
                  preset="secondary"
                  icon="Close"
                  onPress={cancelEditing}
                />
              </MessageInputChromeAction>
            ) : null}
            {canUpload && showAttachmentButton ? (
              <MessageInputChromeAction>
                <AttachmentButton setShouldBlur={setShouldBlur} />
              </MessageInputChromeAction>
            ) : null}
            <MessageInputChromeBody
              isEditing={isEditing}
              editingTintColor={secondaryBackgroundColor}
              overlay={
                floatingActionButton ? null : (
                  <>
                    {showWayfindingTooltip && <Notices.ChatInputTooltip />}
                    {showBotMentionTooltip && <Notices.BotMentionTooltip />}
                  </>
                )
              }
            >
              <MessageInputContentFrame
                backgroundColor={contentBackgroundColor}
              >
                {children}
              </MessageInputContentFrame>
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
                <MessageInputChromeSendAction>
                  <MessageInputChromeButton
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
                </MessageInputChromeSendAction>
              )}
            </MessageInputChromeBody>
          </MessageInputChromeRow>
        ) : (
          // Note: This **must** be an XStack (not a YStack, View, or Stack), otherwise the WebView in MessageInput will not
          // be interactive on Android.
          <XStack
            width="100%"
            backgroundColor="$background"
            onLayout={(event) =>
              handleInputHeightChange(event.nativeEvent.layout.height)
            }
          >
            {children}
          </XStack>
        )}
      </MessageInputChromeRoot>
    );
  }
);

MessageInputContainer.displayName = 'MessageInputContainer';

const usesFloatingChrome = Platform.OS !== 'web';
const usesIOSGlass = supportsLiquidGlass();
const usesAndroidMaterialChrome = Platform.OS === 'android';
const materialChromeAlignment = usesAndroidMaterialChrome
  ? 'flex-end'
  : 'center';

const materialSurfaceProps = {
  backgroundColor: usesAndroidMaterialChrome
    ? '$background'
    : '$secondaryBackground',
  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.24)',
} as const;

function MessageInputChromeRoot({
  children,
  isEditing,
  backgroundColor,
  editingBackgroundColor,
}: PropsWithChildren<{
  isEditing: boolean;
  backgroundColor: string;
  editingBackgroundColor: string;
}>) {
  return (
    <YStack
      width="100%"
      backgroundColor={
        usesFloatingChrome
          ? 'transparent'
          : isEditing
            ? editingBackgroundColor
            : backgroundColor
      }
    >
      {children}
    </YStack>
  );
}

function MessageInputChromeRow({
  children,
  onHeightChange,
}: PropsWithChildren<{
  onHeightChange: (height: number) => void;
}>) {
  const scrollToBottomControl = useConversationScrollToBottomControl();
  const showsScrollToBottomControl = scrollToBottomControl?.visible;
  const handleLayout = (event: LayoutChangeEvent) => {
    onHeightChange(
      event.nativeEvent.layout.height -
        (usesIOSGlass && showsScrollToBottomControl
          ? floatingScrollControlClearance
          : 0)
    );
  };

  if (usesIOSGlass) {
    return (
      <GlassSurfaceGroup
        spacing={metrics.rowGap}
        style={[
          inputChromeStyles.row,
          showsScrollToBottomControl && inputChromeStyles.rowWithScrollControl,
        ]}
        onLayout={handleLayout}
      >
        {scrollToBottomControl && (
          <ConversationScrollToBottomButton
            inComposer
            loading={scrollToBottomControl.isLoading}
            onPress={scrollToBottomControl.onPress}
            visible={scrollToBottomControl.visible}
          />
        )}
        {children}
      </GlassSurfaceGroup>
    );
  }

  if (usesFloatingChrome) {
    return (
      <XStack
        width="100%"
        alignItems={materialChromeAlignment}
        gap={metrics.rowGap}
        paddingHorizontal={metrics.rowPaddingHorizontal}
        paddingVertical={metrics.rowPaddingVertical}
        backgroundColor="transparent"
        onLayout={handleLayout}
      >
        {children}
      </XStack>
    );
  }

  return (
    <XStack
      paddingVertical="$s"
      paddingHorizontal="$xl"
      gap="$l"
      alignItems="flex-end"
      justifyContent="space-between"
      backgroundColor="$background"
      disableOptimization
      onLayout={handleLayout}
    >
      {children}
    </XStack>
  );
}

function MessageInputChromeAction({ children }: PropsWithChildren) {
  if (usesIOSGlass) {
    return (
      <GlassSurface isInteractive style={inputChromeStyles.action}>
        {children}
      </GlassSurface>
    );
  }

  if (usesFloatingChrome) {
    return (
      <View
        {...materialSurfaceProps}
        width={metrics.controlSize}
        height={metrics.controlSize}
        borderRadius={metrics.controlRadius}
        overflow="hidden"
        alignItems="center"
        justifyContent="center"
      >
        {children}
      </View>
    );
  }

  return <View top={2}>{children}</View>;
}

function MessageInputChromeBody({
  children,
  isEditing,
  editingTintColor,
  overlay,
}: PropsWithChildren<{
  isEditing: boolean;
  editingTintColor: string;
  overlay: ReactNode;
}>) {
  if (usesIOSGlass) {
    return (
      <GlassSurface
        glassEffectStyle="regular"
        tintColor={isEditing ? editingTintColor : undefined}
        style={inputChromeStyles.body}
      >
        {children}
        {overlay}
      </GlassSurface>
    );
  }

  if (usesFloatingChrome) {
    return (
      <XStack flex={1} position="relative">
        <XStack
          {...materialSurfaceProps}
          flex={1}
          minHeight={metrics.controlSize}
          borderRadius={metrics.controlRadius}
          alignItems={materialChromeAlignment}
          gap={metrics.rowGap}
          backgroundColor={
            isEditing
              ? '$positiveBackground'
              : usesAndroidMaterialChrome
                ? '$background'
                : '$secondaryBackground'
          }
          overflow="hidden"
        >
          {children}
        </XStack>
        {overlay}
      </XStack>
    );
  }

  return (
    <XStack flex={1} gap="$l" alignItems="flex-end">
      {children}
      {overlay}
    </XStack>
  );
}

function MessageInputContentFrame({
  children,
  backgroundColor,
}: PropsWithChildren<{
  backgroundColor?: ThemeTokens;
}>) {
  if (usesFloatingChrome) {
    return <>{children}</>;
  }

  return (
    <YStack
      flex={1}
      backgroundColor={backgroundColor}
      borderColor="$border"
      borderWidth={1}
      borderRadius="$xl"
    >
      {children}
    </YStack>
  );
}

function MessageInputChromeButton(props: ComponentProps<typeof Button>) {
  if (!usesFloatingChrome) {
    return <Button {...props} />;
  }

  return (
    <Button
      {...props}
      backgroundColor="transparent"
      borderColor="transparent"
    />
  );
}

function MessageInputChromeSendAction({ children }: PropsWithChildren) {
  return (
    <View
      top={usesFloatingChrome ? undefined : 2}
      alignSelf={usesFloatingChrome ? materialChromeAlignment : undefined}
    >
      {children}
    </View>
  );
}

const inputChromeStyles = StyleSheet.create({
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: metrics.rowGap,
    paddingHorizontal: metrics.rowPaddingHorizontal,
    paddingVertical: metrics.rowPaddingVertical,
    backgroundColor: 'transparent',
  },
  // Keep the floating control inside the native glass container's bounds
  // without making the composer or its matching scroll inset any taller.
  rowWithScrollControl: {
    paddingTop: metrics.rowPaddingVertical + floatingScrollControlClearance,
  },
  action: {
    width: metrics.controlSize,
    height: metrics.controlSize,
    borderRadius: metrics.controlRadius,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    minHeight: metrics.controlSize,
    borderRadius: metrics.controlRadius,
    flexDirection: 'row',
    alignItems: 'center',
    gap: metrics.rowGap,
  },
});
