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
} from '@tloncorp/shared/api';
import * as db from '@tloncorp/shared/db';
import {
  Block,
  Story,
  citeToPath,
  constructStory,
  pathToCite,
} from '@tloncorp/shared/urbit';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  YStack,
  getFontSize,
  getVariableValue,
  useTheme,
  useWindowDimensions,
} from 'tamagui';
import { getTokenValue } from 'tamagui';
import { isWeb } from 'tamagui';
import { View } from 'tamagui';

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
  const [controlledText, setControlledText] = useState('');
  const [inputHeight, setInputHeight] = useState(initialHeight);
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

  const lastProcessedRef = useRef('');

  const handleTextChange = (newText: string) => {
    const oldText = controlledText;

    bareChatInputLogger.log('text change', newText);

    // Only process references if the text contains a reference and hasn't been processed before.
    // This check prevents infinite loops on native platforms where we manually update
    // the input's text value using setNativeProps after processing references.
    // Without this guard, each manual text update would trigger another onChangeText,
    // creating an endless cycle.
    if (REF_REGEX.test(newText) && lastProcessedRef.current !== newText) {
      lastProcessedRef.current = newText;
      const textWithoutRefs = processReferences(newText);
      setControlledText(textWithoutRefs);
      handleMention(oldText, textWithoutRefs);

      const jsonContent = textAndMentionsToContent(textWithoutRefs, mentions);
      bareChatInputLogger.log('setting draft', jsonContent);
      storeDraft(jsonContent);

      // force update the native input's text.
      // we must set the text to an empty string because sending any text via
      // setNativeProps is actually *additive* to the existing text and not a replacement.
      // calling setNativeProps is still necessary because it forces the input to update
      // and display the new text value.
      if (!isWeb) {
        inputRef.current?.setNativeProps({ text: '' });
      }
    } else if (!REF_REGEX.test(newText)) {
      // if there's no reference to process, just update normally
      setControlledText(newText);
      handleMention(oldText, newText);

      const jsonContent = textAndMentionsToContent(newText, mentions);
      bareChatInputLogger.log('setting draft', jsonContent);
      storeDraft(jsonContent);
    }
  };

  const onMentionSelect = useCallback(
    (contact: db.Contact) => {
      const newText = handleSelectMention(contact, controlledText);

      if (!newText) {
        return;
      }

      setControlledText(newText);

      // Force focus back to input after mention selection
      inputRef.current?.focus();
    },
    [handleSelectMention, controlledText]
  );

  const renderTextWithMentionsWeb = useMemo(() => {
    if (!controlledText || mentions.length === 0) {
      return null;
    }

    const sortedMentions = [...mentions].sort((a, b) => a.start - b.start);
    const textParts: JSX.Element[] = [];

    // Handle text before first mention
    if (sortedMentions[0].start > 0) {
      textParts.push(
        <RawText key="text-start" color="transparent">
          {controlledText.slice(0, sortedMentions[0].start)}
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
      const nextStart =
        sortedMentions[index + 1]?.start ?? controlledText.length;
      if (mention.end < nextStart) {
        textParts.push(
          <RawText key={`text-${index}`} color="transparent">
            {controlledText.slice(mention.end, nextStart)}
          </RawText>
        );
      }
    });

    return textParts;
  }, [mentions, controlledText]);

  const renderTextWithMentions = useMemo(() => {
    if (!controlledText || mentions.length === 0) {
      return <RawText color="$primaryText">{controlledText}</RawText>;
    }

    const sortedMentions = [...mentions].sort((a, b) => a.start - b.start);
    const textParts: JSX.Element[] = [];

    // Handle text before first mention
    if (sortedMentions[0].start > 0) {
      textParts.push(
        <RawText key="text-start" color="$primaryText">
          {controlledText.slice(0, sortedMentions[0].start)}
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
      const nextStart =
        sortedMentions[index + 1]?.start ?? controlledText.length;
      if (mention.end < nextStart) {
        textParts.push(
          <RawText key={`text-${index}`} color="$primaryText">
            {controlledText.slice(mention.end, nextStart)}
          </RawText>
        );
      }
    });

    return textParts;
  }, [mentions, controlledText]);

  const sendMessage = useCallback(
    async (isEdit?: boolean) => {
      const jsonContent = textAndMentionsToContent(controlledText, mentions);
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

      try {
        setControlledText('');

        if (isEdit && editingPost) {
          if (editingPost.parentId) {
            await editPost?.(
              editingPost,
              story,
              editingPost.parentId,
              metadata
            );
          }
          await editPost?.(editingPost, story, undefined, metadata);
          setEditingPost?.(undefined);
        } else {
          await send(story, channelId, metadata);
        }
      } catch (e) {
        bareChatInputLogger.error('Error sending message', e);
        setSendError(true);
      } finally {
        onSend?.();
        bareChatInputLogger.log('sent message', story);
        setMentions([]);
        bareChatInputLogger.log('clearing attachments');
        clearAttachments();
        bareChatInputLogger.log('clearing draft');
        clearDraft();
        bareChatInputLogger.log('setting initial content');
        setHasSetInitialContent(false);
        bareChatInputLogger.log('resetting input height');
        setInputHeight(initialHeight);
      }
    },
    [
      onSend,
      mentions,
      controlledText,
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
      initialHeight,
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
    setEditorIsEmpty(controlledText === '' && attachments.length === 0);
  }, [controlledText, attachments]);

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
            setControlledText(text);
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
            setControlledText(text);
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

  // Handle pastes on web
  useEffect(() => {
    // For now, we only check to make sure we're on web,
    // we don't check if the input is focused. This allows users to paste
    // images before they select the input. We may want to change this behavior
    // if this feels weird, but it feels like a nice quality of life improvement.
    // We can do this because there is only ever one input on the screen at a time,
    // unlike the old app where you could have both the main chat input and the
    // thread input on screen at the same time.
    if (!isWeb) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items || []);
      const image = items.find((item) => item.type.includes('image'));

      if (!image) return;

      const file = image.getAsFile();
      if (!file) return;

      const uri = URL.createObjectURL(file);

      const img = new Image();

      img.onload = () => {
        addAttachment({
          type: 'image',
          file: {
            uri,
            height: img.height,
            width: img.width,
          },
        });
      };

      img.src = uri;
    };

    document.addEventListener('paste', handlePaste);

    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [addAttachment]);

  const handleCancelEditing = useCallback(() => {
    setEditingPost?.(undefined);
    setHasSetInitialContent(false);
    setControlledText('');
    clearDraft();
    clearAttachments();
    setInputHeight(initialHeight);
  }, [setEditingPost, clearDraft, clearAttachments, initialHeight]);

  const theme = useTheme();

  const placeholderTextColor = {
    placeholderTextColor: getVariableValue(theme.secondaryText),
  };

  const adjustTextInputSize = (e: any) => {
    if (!isWeb) {
      return;
    }

    const el = e?.target;
    if (el && 'style' in el && 'height' in el.style) {
      el.style.height = 0;
      const newHeight = el.offsetHeight - el.clientHeight + el.scrollHeight;
      el.style.height = `${newHeight}px`;
      setInputHeight(newHeight);
    }
  };

  const handleBlur = useCallback(() => {
    setShouldBlur(true);
  }, [setShouldBlur]);

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
          value={isWeb ? controlledText : undefined}
          onChangeText={handleTextChange}
          onChange={isWeb ? adjustTextInputSize : undefined}
          onLayout={isWeb ? adjustTextInputSize : undefined}
          onBlur={handleBlur}
          onKeyPress={(e) => {
            if (isWeb && e.nativeEvent.key === 'Enter') {
              const keyEvent = e.nativeEvent as unknown as KeyboardEvent;
              if (!keyEvent.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }
          }}
          multiline
          placeholder={placeholder}
          {...(!isWeb ? placeholderTextColor : {})}
          style={{
            backgroundColor: 'transparent',
            minHeight: initialHeight,
            height: isWeb ? inputHeight : undefined,
            maxHeight: maxInputHeight - getTokenValue('$s', 'space'),
            paddingHorizontal: getTokenValue('$l', 'space'),
            paddingTop: getTokenValue('$l', 'space'),
            paddingBottom: getTokenValue('$l', 'space'),
            fontSize: getFontSize('$m'),
            textAlignVertical: 'center',
            letterSpacing: -0.032,
            color: getVariableValue(useTheme().primaryText),
            ...(isWeb ? placeholderTextColor : {}),
            ...(isWeb ? { outlineStyle: 'none' } : {}),
          }}
        >
          {isWeb ? undefined : renderTextWithMentions}
        </TextInput>
        {isWeb && mentions.length > 0 && (
          <View height={inputHeight} position="absolute" pointerEvents="none">
            <RawText
              paddingHorizontal="$l"
              paddingTop={getTokenValue('$m', 'space') + 3}
              fontSize="$m"
              lineHeight={getFontSize('$m') * 1.2}
              letterSpacing={-0.032}
              color="$primaryText"
            >
              {renderTextWithMentionsWeb}
            </RawText>
          </View>
        )}
      </YStack>
    </MessageInputContainer>
  );
}
