import {
  JSONToInlines,
  REF_REGEX,
  createDevLogger,
  diaryMixedToJSON,
  extractContentTypesFromPost,
} from '@tloncorp/shared';
import {
  contentReferenceToCite,
  toContentReference,
} from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import {
  Block,
  Story,
  citeToPath,
  constructStory,
  pathToCite,
} from '@tloncorp/shared/dist/urbit';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Platform, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View,
  YStack,
  getFontSize,
  getToken,
  getVariableValue,
  useTheme,
  useWindowDimensions,
} from 'tamagui';

import {
  Attachment,
  UploadedImageAttachment,
  useAttachmentContext,
} from '../../contexts';
import { DEFAULT_MESSAGE_INPUT_HEIGHT } from '../MessageInput';
import { AttachmentPreviewList } from '../MessageInput/AttachmentPreviewList';
import {
  MessageInputContainer,
  MessageInputProps,
} from '../MessageInput/MessageInputBase';
import { RawText, Text } from '../TextV2/Text';
import { contentToTextAndMentions, textAndMentionsToContent } from './helpers';
import { useMentions } from './useMentions';

const bareChatInputLogger = createDevLogger('bareChatInput', false);

export default function BareChatInput({
  shouldBlur,
  setShouldBlur,
  send,
  channelId,
  groupMembers,
  storeDraft,
  clearDraft,
  getDraft,
  editingPost,
  setEditingPost,
  editPost,
  showAttachmentButton,
  paddingHorizontal,
  initialHeight = DEFAULT_MESSAGE_INPUT_HEIGHT,
  backgroundColor,
  placeholder = 'Message',
  image,
  showInlineAttachments,
  channelType,
  onSend,
  goBack,
  shouldAutoFocus,
}: MessageInputProps) {
  const { bottom, top } = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const headerHeight = 48;
  const maxInputHeightBasic = useMemo(
    () => height - headerHeight - bottom - top,
    [height, bottom, top, headerHeight]
  );
  const {
    attachments,
    addAttachment,
    clearAttachments,
    resetAttachments,
    waitForAttachmentUploads,
  } = useAttachmentContext();
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [hasSetInitialContent, setHasSetInitialContent] = useState(false);
  const [editorIsEmpty, setEditorIsEmpty] = useState(attachments.length === 0);
  const [hasAutoFocused, setHasAutoFocused] = useState(false);
  const {
    handleMention,
    handleSelectMention,
    mentionSearchText,
    mentions,
    setMentions,
    showMentionPopup,
  } = useMentions();
  const [maxInputHeight, setMaxInputHeight] = useState(maxInputHeightBasic);
  const inputRef = useRef<TextInput>(null);

  const processReferences = useCallback(
    (text: string): string => {
      const references = text.match(REF_REGEX);
      if (!references) {
        return text;
      }

      let newText = text;
      references.forEach((ref) => {
        const cite = pathToCite(ref);
        if (!cite) {
          return;
        }
        const reference = toContentReference(cite);
        if (!reference) {
          return;
        }

        addAttachment({
          type: 'reference',
          reference,
          path: ref,
        });

        newText = newText.replace(ref, '');
      });

      return newText;
    },
    [addAttachment]
  );

  const handleTextChange = (newText: string) => {
    const oldText = text;

    const textWithoutRefs = processReferences(newText);

    setText(textWithoutRefs);

    handleMention(oldText, textWithoutRefs);

    const jsonContent = textAndMentionsToContent(textWithoutRefs, mentions);
    bareChatInputLogger.log('setting draft', jsonContent);
    storeDraft(jsonContent);
  };

  const onMentionSelect = useCallback(
    (contact: db.Contact) => {
      const newText = handleSelectMention(contact, text);

      if (!newText) {
        return;
      }

      setText(newText);

      // Force focus back to input after mention selection
      inputRef.current?.focus();
    },
    [handleSelectMention, text]
  );

  const renderTextWithMentions = useMemo(() => {
    if (!text || mentions.length === 0) {
      return null;
    }

    const sortedMentions = [...mentions].sort((a, b) => a.start - b.start);
    const textParts: JSX.Element[] = [];

    // Handle text before first mention
    if (sortedMentions[0].start > 0) {
      textParts.push(
        <RawText key="text-start" color="transparent">
          {text.slice(0, sortedMentions[0].start)}
        </RawText>
      );
    }

    // Handle mentions and text between them
    sortedMentions.forEach((mention, index) => {
      textParts.push(
        <Text
          key={`mention-${mention.id}-${index}`}
          color="$positiveActionText"
          backgroundColor="$positiveBackground"
        >
          {mention.display}
        </Text>
      );

      // Add text between this mention and the next one (or end of text)
      const nextStart = sortedMentions[index + 1]?.start ?? text.length;
      if (mention.end < nextStart) {
        textParts.push(
          <RawText key={`text-${index}`} color="transparent">
            {text.slice(mention.end, nextStart)}
          </RawText>
        );
      }
    });

    return textParts;
  }, [mentions, text]);

  const sendMessage = useCallback(
    async (isEdit?: boolean) => {
      const jsonContent = textAndMentionsToContent(text, mentions);
      const inlines = JSONToInlines(jsonContent);
      const story = constructStory(inlines);

      const finalAttachments = await waitForAttachmentUploads();

      const blocks = finalAttachments.flatMap((attachment): Block[] => {
        if (attachment.type === 'reference') {
          const cite = pathToCite(attachment.path);
          return cite ? [{ cite }] : [];
        }
        if (
          attachment.type === 'image' &&
          (!image || attachment.file.uri !== image?.uri)
        ) {
          return [
            {
              image: {
                src: attachment.uploadState.remoteUri,
                height: attachment.file.height,
                width: attachment.file.width,
                alt: 'image',
              },
            },
          ];
        }

        if (
          image &&
          attachment.type === 'image' &&
          attachment.file.uri === image?.uri &&
          isEdit &&
          channelType === 'gallery'
        ) {
          return [
            {
              image: {
                src: image.uri,
                height: image.height,
                width: image.width,
                alt: 'image',
              },
            },
          ];
        }

        return [];
      });

      if (blocks && blocks.length > 0) {
        if (channelType === 'chat') {
          story.unshift(...blocks.map((block) => ({ block })));
        } else {
          story.push(...blocks.map((block) => ({ block })));
        }
      }

      const metadata: db.PostMetadata = {};

      if (image) {
        const attachment = finalAttachments.find(
          (a): a is UploadedImageAttachment =>
            a.type === 'image' && a.file.uri === image.uri
        );
        if (!attachment) {
          throw new Error('unable to attach image');
        }
        metadata['image'] = attachment.uploadState.remoteUri;
      }

      if (isEdit && editingPost) {
        if (editingPost.parentId) {
          await editPost?.(editingPost, story, editingPost.parentId, metadata);
        }
        await editPost?.(editingPost, story, undefined, metadata);
        setEditingPost?.(undefined);
      } else {
        // not awaiting since we don't want to wait for the send to complete
        // before clearing the draft and the editor content
        send(story, channelId, metadata);
      }

      onSend?.();
      setText('');
      setMentions([]);
      clearAttachments();
      clearDraft();
    },
    [
      onSend,
      mentions,
      text,
      waitForAttachmentUploads,
      editingPost,
      clearAttachments,
      clearDraft,
      editPost,
      setEditingPost,
      image,
      channelType,
      send,
      channelId,
      setMentions,
    ]
  );

  const runSendMessage = useCallback(
    async (isEdit: boolean) => {
      setIsSending(true);
      try {
        await sendMessage(isEdit);
      } catch (e) {
        bareChatInputLogger.trackError('failed to send', e);
        setSendError(true);
      }
      setIsSending(false);
      setSendError(false);
    },
    [sendMessage]
  );

  const handleSend = useCallback(async () => {
    Keyboard.dismiss();
    runSendMessage(false);
  }, [runSendMessage]);

  const handleEdit = useCallback(async () => {
    Keyboard.dismiss();
    if (!editingPost) {
      return;
    }
    runSendMessage(true);
  }, [runSendMessage, editingPost]);

  // Make sure the user can still see some of the scroller when the keyboard is up
  useEffect(() => {
    Keyboard.addListener('keyboardDidShow', () => {
      const keyboardHeight = Keyboard.metrics()?.height || 300;
      setMaxInputHeight(maxInputHeightBasic - keyboardHeight);
    });

    Keyboard.addListener('keyboardDidHide', () => {
      setMaxInputHeight(maxInputHeightBasic);
    });
  }, [maxInputHeightBasic]);

  // Handle autofocus
  useEffect(() => {
    if (!shouldBlur && shouldAutoFocus && !hasAutoFocused) {
      inputRef.current?.focus();
      setHasAutoFocused(true);
    }
  }, [shouldBlur, shouldAutoFocus, hasAutoFocused]);

  // Blur input when needed
  useEffect(() => {
    if (shouldBlur) {
      inputRef.current?.blur();
      setShouldBlur(false);
    }
  }, [shouldBlur, setShouldBlur]);

  // Check if editor is empty
  useEffect(() => {
    setEditorIsEmpty(text === '' && attachments.length === 0);
  }, [text, attachments]);

  // Set initial content from draft or post that is being edited
  useEffect(() => {
    if (!hasSetInitialContent) {
      bareChatInputLogger.log('setting initial content');
      try {
        getDraft().then((draft) => {
          bareChatInputLogger.log('got draft', draft);
          if (
            !editingPost &&
            draft &&
            draft.content &&
            draft.content.length > 0
          ) {
            setEditorIsEmpty(false);
            setHasSetInitialContent(true);
            bareChatInputLogger.log('setting initial content', draft);
            const { text, mentions } = contentToTextAndMentions(draft);
            bareChatInputLogger.log(
              'setting initial content text and mentions',
              text,
              mentions
            );
            setText(text);
            setMentions(mentions);
          }

          if (editingPost && editingPost.content) {
            const {
              story,
              references: postReferences,
              blocks,
            } = extractContentTypesFromPost(editingPost);

            if (story === null && !postReferences && blocks.length === 0) {
              return;
            }

            const attachments: Attachment[] = [];

            postReferences.forEach((p) => {
              const cite = contentReferenceToCite(p);
              const path = citeToPath(cite);
              attachments.push({
                type: 'reference',
                reference: p,
                path,
              });
            });

            blocks.forEach((b) => {
              if ('image' in b) {
                attachments.push({
                  type: 'image',
                  file: {
                    uri: b.image.src,
                    height: b.image.height,
                    width: b.image.width,
                  },
                });
              }
            });

            resetAttachments(attachments);
            const jsonContent = diaryMixedToJSON(
              story?.filter(
                (c) => !('type' in c) && !('block' in c && 'image' in c.block)
              ) as Story
            );

            bareChatInputLogger.log('jsonContent', jsonContent);
            const { text, mentions } = contentToTextAndMentions(jsonContent);
            bareChatInputLogger.log('setting initial content', text, mentions);
            setText(text);
            setMentions(mentions);
            setEditorIsEmpty(false);
            setHasSetInitialContent(true);
          }

          if (editingPost?.image) {
            addAttachment({
              type: 'image',
              file: {
                uri: editingPost.image,
                height: 0,
                width: 0,
              },
            });
          }
        });
      } catch (e) {
        bareChatInputLogger.error('Error setting initial content', e);
      }
    }
  }, [
    getDraft,
    hasSetInitialContent,
    editingPost,
    resetAttachments,
    addAttachment,
    setMentions,
  ]);

  const handleCancelEditing = useCallback(() => {
    setEditingPost?.(undefined);
    setHasSetInitialContent(false);
    setText('');
    clearDraft();
    clearAttachments();
  }, [setEditingPost, clearDraft, clearAttachments]);

  const paddingTopAdjustment = Platform.OS === 'ios' ? 2 : 4;
  const mentionLineHeightAdjustment = Platform.OS === 'ios' ? 1.3 : 1.5;

  return (
    <MessageInputContainer
      onPressSend={handleSend}
      setShouldBlur={setShouldBlur}
      containerHeight={48}
      disableSend={editorIsEmpty}
      sendError={sendError}
      showMentionPopup={showMentionPopup}
      mentionText={mentionSearchText}
      showAttachmentButton={showAttachmentButton}
      groupMembers={groupMembers}
      onSelectMention={onMentionSelect}
      isSending={isSending}
      isEditing={!!editingPost}
      cancelEditing={handleCancelEditing}
      onPressEdit={handleEdit}
      goBack={goBack}
    >
      <YStack
        flex={1}
        backgroundColor={backgroundColor}
        paddingHorizontal={paddingHorizontal}
        borderColor="$border"
        borderWidth={1}
        borderRadius="$xl"
        maxHeight={maxInputHeight}
        justifyContent="center"
      >
        {showInlineAttachments && <AttachmentPreviewList />}
        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={handleTextChange}
          multiline
          style={{
            backgroundColor: 'transparent',
            minHeight: initialHeight,
            maxHeight: maxInputHeight - getToken('$s', 'size'),
            paddingHorizontal: getToken('$l', 'space'),
            paddingTop: getToken('$s', 'space') + paddingTopAdjustment,
            paddingBottom: getToken('$s', 'space'),
            fontSize: getFontSize('$m'),
            textAlignVertical: 'top',
            lineHeight: getFontSize('$m') * 1.5,
            letterSpacing: -0.032,
            color: getVariableValue(useTheme().primaryText),
          }}
          placeholder={placeholder}
        />
        {mentions.length > 0 && (
          <View position="absolute" pointerEvents="none">
            <RawText
              paddingHorizontal="$l"
              paddingTop={Platform.OS === 'android' ? '$s' : 0}
              paddingBottom="$xs"
              fontSize="$m"
              lineHeight={getFontSize('$m') * mentionLineHeightAdjustment}
              letterSpacing={-0.032}
              color="$primaryText"
            >
              {renderTextWithMentions}
            </RawText>
          </View>
        )}
      </YStack>
    </MessageInputContainer>
  );
}
