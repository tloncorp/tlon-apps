import {
  Attachment,
  JSONToInlines,
  REF_REGEX,
  TextAttachment,
  createDevLogger,
  diaryMixedToJSON,
  extractContentTypesFromPost,
} from '@tloncorp/shared';
import {
  contentReferenceToCite,
  toContentReference,
} from '@tloncorp/shared/api';
import * as db from '@tloncorp/shared/db';
import type * as domain from '@tloncorp/shared/domain';
import * as logic from '@tloncorp/shared/logic';
import { Story, citeToPath, pathToCite } from '@tloncorp/shared/urbit';
import { LoadingSpinner, RawText, Text, useGlobalSearch } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View,
  YStack,
  getFontSize,
  getTokenValue,
  getVariableValue,
  isWeb,
  useTheme,
  useWindowDimensions,
} from 'tamagui';

import { useAttachmentContext, useStore } from '../../contexts';
import { MentionController } from '../MentionPopup';
import { DEFAULT_MESSAGE_INPUT_HEIGHT } from '../MessageInput';
import { AttachmentPreviewList } from '../MessageInput/AttachmentPreviewList';
import {
  MessageInputContainer,
  MessageInputProps,
} from '../MessageInput/MessageInputBase';
import { contentToTextAndMentions, textAndMentionsToContent } from './helpers';
import {
  MentionOption,
  createMentionOptions,
  useMentions,
} from './useMentions';

const bareChatInputLogger = createDevLogger('bareChatInput', false);

const DEFAULT_KEYBOARD_HEIGHT = 300;

function useKeyboardHeight(maxInputHeightBasic: number) {
  const [maxInputHeight, setMaxInputHeight] = useState(maxInputHeightBasic);

  useEffect(() => {
    const handleKeyboardShow = () => {
      const keyboardHeight =
        Keyboard.metrics()?.height || DEFAULT_KEYBOARD_HEIGHT;
      setMaxInputHeight(maxInputHeightBasic - keyboardHeight);
    };

    const handleKeyboardHide = () => {
      setMaxInputHeight(maxInputHeightBasic);
    };

    const showSubscription = Keyboard.addListener(
      'keyboardDidShow',
      handleKeyboardShow
    );
    const hideSubscription = Keyboard.addListener(
      'keyboardDidHide',
      handleKeyboardHide
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [maxInputHeightBasic]);

  return maxInputHeight;
}

function usePasteHandler(addAttachment: (attachment: Attachment) => void) {
  // For now, we only check to make sure we're on web,
  // we don't check if the input is focused. This allows users to paste
  // images before they select the input. We may want to change this behavior
  // if this feels weird, but it feels like a nice quality of life improvement.
  // We can do this because there is only ever one input on the screen at a time,
  // unlike the old app where you could have both the main chat input and the
  // thread input on screen at the same time.
  useEffect(() => {
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
    return () => document.removeEventListener('paste', handlePaste);
  }, [addAttachment]);
}

interface TextWithMentionsProps {
  text: string;
  mentions: Array<{ start: number; end: number; display: string; id: string }>;
  textColor: string;
}

function TextWithMentions({
  text,
  mentions,
  textColor,
}: TextWithMentionsProps) {
  if (!text || mentions.length === 0) {
    return <RawText color={textColor}>{text}</RawText>;
  }

  const sortedMentions = [...mentions].sort((a, b) => a.start - b.start);
  const textParts: JSX.Element[] = [];

  if (sortedMentions[0].start > 0) {
    textParts.push(
      <RawText key="text-start" color={textColor}>
        {text.slice(0, sortedMentions[0].start)}
      </RawText>
    );
  }

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

    const nextStart = sortedMentions[index + 1]?.start ?? text.length;
    if (mention.end < nextStart) {
      textParts.push(
        <RawText key={`text-${index}`} color={textColor}>
          {text.slice(mention.end, nextStart)}
        </RawText>
      );
    }
  });

  return <>{textParts}</>;
}

function LinkPreviewLoading() {
  return (
    <View
      backgroundColor="$secondaryBackground"
      padding="$m"
      margin="$m"
      borderRadius="$m"
      alignItems="center"
      justifyContent="center"
      width={240}
      height={200}
      overflow="hidden"
    >
      <LoadingSpinner color="$primaryText" size="small" />
    </View>
  );
}

export default function BareChatInput({
  shouldBlur,
  setShouldBlur,
  channelId,
  groupMembers,
  groupRoles,
  storeDraft,
  clearDraft,
  getDraft,
  editingPost,
  setEditingPost,
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
  showWayfindingTooltip,
  sendPostFromDraft,
}: MessageInputProps) {
  const { bottom, top } = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const store = useStore();
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
    removeAttachment,
  } = useAttachmentContext();
  const [controlledText, setControlledText] = useState('');
  const [inputHeight, setInputHeight] = useState(initialHeight);
  const [sendError, setSendError] = useState(false);
  const [hasSetInitialContent, setHasSetInitialContent] = useState(false);
  const [editorIsEmpty, setEditorIsEmpty] = useState(attachments.length === 0);
  const [hasAutoFocused, setHasAutoFocused] = useState(false);
  const [needsHeightAdjustmentAfterLoad, setNeedsHeightAdjustmentAfterLoad] =
    useState(false);
  const options = useMemo(() => {
    return createMentionOptions(groupMembers, groupRoles);
  }, [groupMembers, groupRoles]);

  const {
    mentions,
    validOptions,
    mentionSearchText,
    isMentionModeActive,
    hasMentionCandidates,
    setMentions,
    handleMention,
    handleSelectMention,
    handleMentionEscape,
  } = useMentions({ options });
  const maxInputHeight = useKeyboardHeight(maxInputHeightBasic);
  const inputRef = useRef<TextInput>(null);

  usePasteHandler(addAttachment);

  const [linkMetaLoading, setLinkMetaLoading] = useState(false);
  // Track current input session to cancel stale link previews
  const inputSessionRef = useRef(0);
  const disableSend = editorIsEmpty;

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
  const mentionRef = useRef<MentionController>(null);

  const handleTextChange = useCallback(
    (newText: string) => {
      const oldText = controlledText;

      bareChatInputLogger.log('text change', newText);

      const pastedSomething = newText.length > oldText.length + 10;
      if (pastedSomething) {
        const addedText = newText.substring(oldText.length);
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const matches = addedText.match(urlRegex);

        if (matches && matches.length > 0) {
          // Found a URL in what appears to be pasted text
          const urlMatch = matches[0];
          const parsedUrl = new URL(urlMatch);
          parsedUrl.hash = '';
          const url = parsedUrl.toString();

          // Capture current session to check if request is still valid later
          const currentSession = inputSessionRef.current;
          setLinkMetaLoading(true);
          bareChatInputLogger.log('getting link metadata', { url });

          store
            .getLinkMetaWithFallback(url)
            .then((linkMetadata) => {
              // Check if this request is still valid (message hasn't been sent)
              if (currentSession !== inputSessionRef.current) {
                bareChatInputLogger.log('ignoring stale link metadata', {
                  url,
                });
                return;
              }

              // todo: handle error case with toast or similar
              if (!linkMetadata) {
                bareChatInputLogger.error('no link metadata', { url });
                return;
              }

              bareChatInputLogger.log('link metadata', { linkMetadata });

              // first add the link attachment
              if (linkMetadata.type === 'page') {
                const { type, ...rest } = linkMetadata;
                addAttachment({
                  type: 'link',
                  resourceType: type,
                  ...rest,
                });
              }

              if (linkMetadata.type === 'file') {
                if (linkMetadata.isImage) {
                  addAttachment({
                    type: 'image',
                    file: {
                      uri: url,
                      height: 300,
                      width: 300,
                      mimeType: linkMetadata.mime,
                    },
                  });
                }

                const fileType = linkMetadata.mime.split('/')[1];
                const fileName = url.split('/').pop();
                console.log('fileName', fileName);

                addAttachment({
                  type: 'link',
                  url: url,
                  title: fileName,
                  description: fileType,
                });
              }
            })
            .finally(() => {
              // Only clear loading if this is still the current session
              if (currentSession === inputSessionRef.current) {
                setLinkMetaLoading(false);
              }
            });
        }
      }

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
    },
    [
      controlledText,
      store,
      addAttachment,
      processReferences,
      handleMention,
      mentions,
      storeDraft,
    ]
  );

  const onMentionSelect = useCallback(
    (option: MentionOption) => {
      const newText = handleSelectMention(option, controlledText);

      if (!newText) {
        return;
      }

      setControlledText(newText);

      // Force focus back to input after mention selection
      inputRef.current?.focus();
    },
    [handleSelectMention, controlledText]
  );

  // Handle text attachments by inserting them into the input
  useEffect(() => {
    const textAttachment = attachments.find(
      (a): a is TextAttachment => a.type === 'text'
    );
    if (textAttachment) {
      if (controlledText === '') {
        handleTextChange(`${textAttachment.text}`);
      } else {
        handleTextChange(`${textAttachment.text}${controlledText}`);
      }
      // Remove the text attachment since we've handled it
      removeAttachment(textAttachment);
    }
  }, [attachments, handleTextChange, removeAttachment, controlledText]);

  const sendMessage = useCallback(
    async (isEdit?: boolean) => {
      const jsonContent = textAndMentionsToContent(controlledText, mentions);
      const inlines = JSONToInlines(jsonContent);

      const draft: domain.PostDataDraft = (() => {
        const draftBase = {
          channelId,
          content: inlines,
          attachments,
          image: image?.uri,
          channelType,
        };
        if (isEdit && editingPost?.id) {
          return {
            ...draftBase,
            isEdit,
            editTargetPostId: editingPost.id,
          };
        } else {
          return draftBase;
        }
      })();

      // Cancel any pending link preview requests
      inputSessionRef.current += 1;
      setLinkMetaLoading(false);

      setControlledText('');
      bareChatInputLogger.log('clearing attachments');
      clearAttachments();
      bareChatInputLogger.log('resetting input height');
      setInputHeight(initialHeight);
      setEditingPost?.(undefined);

      try {
        await sendPostFromDraft(draft);
      } catch (e) {
        bareChatInputLogger.error('Error sending message', e);
        setSendError(true);
      } finally {
        onSend?.();
        bareChatInputLogger.log('sent message');
        setMentions([]);
        bareChatInputLogger.log('clearing draft');
        await clearDraft();
        bareChatInputLogger.log('setting initial content');
        setHasSetInitialContent(false);
      }
    },
    [
      sendPostFromDraft,
      attachments,
      onSend,
      mentions,
      controlledText,
      editingPost,
      clearAttachments,
      clearDraft,
      setEditingPost,
      image,
      channelType,
      channelId,
      setMentions,
      initialHeight,
    ]
  );

  const runSendMessage = useCallback(
    async (isEdit: boolean) => {
      try {
        await sendMessage(isEdit);
      } catch (e) {
        bareChatInputLogger.trackError('failed to send', e);
        setSendError(true);
      } finally {
        setTimeout(() => {
          // allow some time for send errors to be displayed
          // before clearing the error state
          setSendError(false);
        }, 2000);
      }
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
    setEditorIsEmpty(
      (controlledText === '' || controlledText.trim() === '') &&
        attachments.length === 0
    );
  }, [controlledText, attachments]);

  const adjustInputHeightProgrammatically = useCallback(() => {
    if (!isWeb || !inputRef.current) {
      return;
    }

    const el = inputRef.current;
    const htmlEl = el as unknown as HTMLElement;
    if (
      htmlEl &&
      'style' in htmlEl &&
      'offsetHeight' in htmlEl &&
      'clientHeight' in htmlEl &&
      'scrollHeight' in htmlEl
    ) {
      // We need to use requestAnimationFrame to ensure DOM is fully updated
      // after setting the text state before calculating the scrollHeight.
      requestAnimationFrame(() => {
        htmlEl.style.height = '0'; // Temporarily shrink to calculate scrollHeight correctly
        const newHeight =
          htmlEl.offsetHeight - htmlEl.clientHeight + htmlEl.scrollHeight;
        // Only resize if new height is greater than initial height to avoid shrinking unnecessarily
        if (newHeight > initialHeight) {
          htmlEl.style.height = `${newHeight}px`;
          setInputHeight(newHeight);
        } else {
          // Ensure it resets to initial height if content is smaller
          htmlEl.style.height = `${initialHeight}px`;
          setInputHeight(initialHeight);
        }
      });
    }
  }, [initialHeight]);

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
            setNeedsHeightAdjustmentAfterLoad(true);
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
              if ('link' in b) {
                attachments.push({
                  type: 'link',
                  url: b.link.url,
                  resourceType: 'page',
                  ...b.link.meta,
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
            setNeedsHeightAdjustmentAfterLoad(true);
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

  useEffect(() => {
    if (needsHeightAdjustmentAfterLoad) {
      adjustInputHeightProgrammatically();
      setNeedsHeightAdjustmentAfterLoad(false); // Reset the flag
    }
  }, [needsHeightAdjustmentAfterLoad, adjustInputHeightProgrammatically]);

  const handleCancelEditing = useCallback(() => {
    // Cancel any pending link preview requests
    inputSessionRef.current += 1;
    setLinkMetaLoading(false);

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
  const inputTextColor = getVariableValue(theme.primaryText);

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

  const { setIsOpen } = useGlobalSearch();

  const handleBlur = useCallback(() => {
    setShouldBlur(true);
  }, [setShouldBlur]);

  const handleFocus = useCallback(() => {
    // dismiss wayfinding tooltip if needed
    if (logic.isPersonalChatChannel(channelId)) {
      db.wayfindingProgress.setValue((prev) => ({
        ...prev,
        tappedChatInput: true,
      }));
    }
  }, [channelId]);

  const handleKeyPress = useCallback(
    (e: any) => {
      const keyEvent = e.nativeEvent as unknown as KeyboardEvent;
      if (!isWeb) return;

      if (
        (keyEvent.metaKey || keyEvent.ctrlKey) &&
        keyEvent.key.toLowerCase() === 'k'
      ) {
        e.preventDefault();
        inputRef.current?.blur();
        setIsOpen(true);
        return;
      }

      if (
        (keyEvent.key === 'ArrowUp' || keyEvent.key === 'ArrowDown') &&
        isMentionModeActive
      ) {
        e.preventDefault();
        mentionRef.current?.handleMentionKey(keyEvent.key);
      }

      if (keyEvent.key === 'Escape') {
        if (isMentionModeActive) {
          e.preventDefault();
          handleMentionEscape();
        }
      }

      if (keyEvent.key === 'Enter' && !keyEvent.shiftKey) {
        e.preventDefault();
        if (isMentionModeActive && hasMentionCandidates) {
          mentionRef.current?.handleMentionKey('Enter');
        } else if (editingPost) {
          handleEdit();
        } else if (!disableSend) {
          handleSend();
        }
      }
    },
    [
      isMentionModeActive,
      setIsOpen,
      handleMentionEscape,
      hasMentionCandidates,
      editingPost,
      disableSend,
      handleEdit,
      handleSend,
    ]
  );

  return (
    <MessageInputContainer
      onPressSend={handleSend}
      setShouldBlur={setShouldBlur}
      containerHeight={48}
      disableSend={disableSend}
      sendError={sendError}
      showWayfindingTooltip={showWayfindingTooltip}
      isMentionModeActive={isMentionModeActive}
      mentionText={mentionSearchText}
      mentionOptions={validOptions}
      mentionRef={mentionRef}
      onSelectMention={onMentionSelect}
      showAttachmentButton={showAttachmentButton}
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
        {linkMetaLoading && <LinkPreviewLoading />}
        {showInlineAttachments && <AttachmentPreviewList />}
        <TextInput
          testID="MessageInput"
          ref={inputRef}
          value={isWeb ? controlledText : undefined}
          onChangeText={handleTextChange}
          onChange={isWeb ? adjustTextInputSize : undefined}
          onLayout={isWeb ? adjustTextInputSize : undefined}
          onBlur={handleBlur}
          onFocus={handleFocus}
          onKeyPress={handleKeyPress}
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
            verticalAlign: 'middle',
            letterSpacing: -0.032,
            color: inputTextColor,
            ...(isWeb ? placeholderTextColor : {}),
            ...(isWeb ? { outlineStyle: 'none' } : {}),
          }}
          // Hack to prevent @p's getting squiggled on web
          spellCheck={!mentions.length}
        >
          {isWeb ? undefined : (
            <TextWithMentions
              text={controlledText}
              mentions={mentions}
              textColor="$primaryText"
            />
          )}
        </TextInput>
        {isWeb && !!controlledText && mentions.length > 0 && (
          <View height={inputHeight} position="absolute" pointerEvents="none">
            <RawText
              paddingHorizontal="$l"
              paddingTop={getTokenValue('$m', 'space') + 3}
              fontSize="$m"
              lineHeight={getFontSize('$m') * 1.2}
              letterSpacing={-0.032}
              color="$primaryText"
            >
              <TextWithMentions
                text={controlledText}
                mentions={mentions}
                textColor="transparent"
              />
            </RawText>
          </View>
        )}
      </YStack>
    </MessageInputContainer>
  );
}
