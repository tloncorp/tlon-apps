import { toContentReference } from '@tloncorp/api';
import { JSONContent, Story, pathToCite } from '@tloncorp/api/urbit';
import {
  Attachment,
  JSONToInlines,
  REF_REGEX,
  createDevLogger,
  diaryMixedToJSON,
  useDebouncedValue,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import type * as domain from '@tloncorp/shared/domain';
import * as logic from '@tloncorp/shared/logic';
import {
  HEADER_HEIGHT,
  LoadingSpinner,
  RawText,
  Text,
  useGlobalSearch,
} from '@tloncorp/ui';
import {
  type ForwardedRef,
  ReactElement,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
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

import { useAttachmentContext } from '../../contexts/attachment';
import { useStore } from '../../contexts/storeContext';
import { getVideoPreviewData } from '../../utils/videoPreviewData';
import { MentionController } from '../MentionPopup';
import { DEFAULT_MESSAGE_INPUT_HEIGHT } from '../MessageInput';
import { AttachmentPreviewList } from '../MessageInput/AttachmentPreviewList';
import {
  MessageInputContainer,
  MessageInputProps,
} from '../MessageInput/MessageInputBase';
import { hydrateEditPost } from '../MessageInput/helpers';
import type { DraftInputHandle } from '../draftInputs/shared';
import { contentToTextAndMentions, textAndMentionsToContent } from './helpers';
import {
  MentionOption,
  createMentionRoleOptions,
  useMentions,
} from './useMentions';

const bareChatInputLogger = createDevLogger('bareChatInput', false);

const DEFAULT_KEYBOARD_HEIGHT = 300;

function normalizePreviewUrl(url: string) {
  try {
    const parsedUrl = new URL(url);
    parsedUrl.hash = '';
    return parsedUrl.toString();
  } catch {
    return url;
  }
}

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
      const media = items.find(
        (item) => item.type.includes('image') || item.type.includes('video')
      );

      if (!media) return;

      const file = media.getAsFile();
      if (!file) return;

      if (media.type.includes('image')) {
        const uri = URL.createObjectURL(file);
        const img = new Image();

        img.onload = () => {
          addAttachment({
            type: 'image',
            file: {
              uri,
              height: img.height,
              width: img.width,
              mimeType: file.type || undefined,
              fileSize: file.size,
            },
          });
        };

        img.src = uri;
        return;
      }

      if (media.type.includes('video')) {
        const previewData = await getVideoPreviewData({ file });
        addAttachment({
          type: 'video',
          localFile: file,
          size: file.size,
          mimeType: file.type,
          name: file.name,
          width: previewData.width,
          height: previewData.height,
          duration: previewData.duration,
          posterUri: previewData.posterUri,
        });
      }
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
  const textParts: ReactElement[] = [];

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
        testID={`SelectedMention-${mention.id}`}
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

function BareChatInput(
  {
    shouldBlur,
    setShouldBlur,
    channelId,
    groupId,
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
    showBotMentionTooltip,
    sendPostFromDraft,
  }: MessageInputProps,
  ref: ForwardedRef<DraftInputHandle>
) {
  const { bottom, top } = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const store = useStore();
  const maxInputHeightBasic = useMemo(
    () => height - HEADER_HEIGHT - bottom - top,
    [height, bottom, top]
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

  const roleOptions = useMemo(() => {
    return createMentionRoleOptions(groupRoles);
  }, [groupRoles]);

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
    resetMentionMode,
  } = useMentions({ chatId: groupId ?? channelId, roleOptions });
  const maxInputHeight = useKeyboardHeight(maxInputHeightBasic);
  const inputRef = useRef<TextInput>(null);

  usePasteHandler(addAttachment);

  const [linkMetaLoading, setLinkMetaLoading] = useState(false);
  // Track current input session to cancel stale link previews
  const inputSessionRef = useRef(0);
  const disableSend = editorIsEmpty;

  // Debounced text for URL watching - syncs link attachments with URLs in text
  const debouncedText = useDebouncedValue(controlledText, 500);
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;
  const prevUrlsRef = useRef<string[]>([]);

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

      // Only process references if the text contains a reference and hasn't been processed before.
      // This check prevents infinite loops on native platforms where we manually update
      // the input's text value using setNativeProps after processing references.
      // Without this guard, each manual text update would trigger another onChangeText,
      // creating an endless cycle.
      if (REF_REGEX.test(newText) && lastProcessedRef.current !== newText) {
        lastProcessedRef.current = newText;
        const textWithoutRefs = processReferences(newText);
        const cursorPos = isWeb
          ? (inputRef.current as any)?.selectionStart
          : undefined;
        const adjustedCursorPos =
          cursorPos != null
            ? Math.max(0, cursorPos - (newText.length - textWithoutRefs.length))
            : undefined;
        setControlledText(textWithoutRefs);
        handleMention(oldText, textWithoutRefs, adjustedCursorPos);

        const jsonContent = textAndMentionsToContent(textWithoutRefs, mentions);
        bareChatInputLogger.log('setting draft', jsonContent);
        storeDraft(jsonContent);

        // Clear the native input's text after processing references.
        // We defer with setTimeout because .clear() uses mostRecentEventCount
        // internally, which isn't updated until after onChangeText returns.
        // Calling it synchronously would use a stale event count that gets rejected.
        if (!isWeb) {
          setTimeout(() => {
            inputRef.current?.clear();
          }, 0);
        }
      } else if (!REF_REGEX.test(newText)) {
        // if there's no reference to process, just update normally
        const cursorPos = isWeb
          ? (inputRef.current as any)?.selectionStart
          : undefined;
        setControlledText(newText);
        handleMention(oldText, newText, cursorPos);

        const jsonContent = textAndMentionsToContent(newText, mentions);
        bareChatInputLogger.log('setting draft', jsonContent);
        storeDraft(jsonContent);
      }
    },
    [controlledText, processReferences, handleMention, mentions, storeDraft]
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
          replyToPostId: null,
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
      resetMentionMode();

      try {
        bareChatInputLogger.log('sending message');
        const sendOperation = sendPostFromDraft(draft);
        bareChatInputLogger.log('clearing draft');
        await clearDraft();
        await sendOperation;
      } catch (e) {
        bareChatInputLogger.error('Error sending message', e);
        setSendError(true);
      } finally {
        onSend?.();
        bareChatInputLogger.log('sent message');
        setMentions([]);
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
      resetMentionMode,
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

  // Sync link attachments with URLs in text
  // This effect watches for URL changes and updates link previews accordingly
  useEffect(() => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    // Strip backtick code spans/blocks (including unclosed ones) before
    // scanning for URLs so that URLs inside code fences are not turned into
    // link attachments. Triple-backtick alternation is listed first so that
    // ``` is not accidentally consumed by the single-backtick branch.
    const textOutsideCodeBlocks = debouncedText.replace(
      /```[\s\S]*?(?:```|$)|`[^`]*(?:`|$)/g,
      ''
    );
    const matches = textOutsideCodeBlocks.match(urlRegex) || [];

    // Normalize URLs (remove hash) and deduplicate
    const currentUrls = [...new Set(matches.map(normalizePreviewUrl))];

    const prevUrls = prevUrlsRef.current;
    const linksByUrl = new Map(
      attachmentsRef.current
        .filter((a) => a.type === 'link')
        .map((a) => [normalizePreviewUrl(a.url), a] as const)
    );

    const removedUrls = prevUrls.filter((url) => !currentUrls.includes(url));
    const addedUrls = currentUrls.filter(
      (url) => !prevUrls.includes(url) && !linksByUrl.has(url)
    );

    // Remove attachments for URLs no longer in text
    removedUrls.forEach((url) => {
      const attachment = linksByUrl.get(url);
      if (attachment) {
        bareChatInputLogger.log('removing stale link attachment', { url });
        removeAttachment(attachment);
      }
    });

    // Fetch metadata for new URLs
    if (addedUrls.length > 0) {
      setLinkMetaLoading(true);
      const currentSession = inputSessionRef.current;

      Promise.all(
        addedUrls.map((url) =>
          store.getLinkMetaWithFallback(url).then((linkMetadata) => {
            // Check if this request is still valid
            if (currentSession !== inputSessionRef.current) {
              bareChatInputLogger.log('ignoring stale link metadata', {
                url,
              });
              return;
            }

            if (!linkMetadata) {
              bareChatInputLogger.error('no link metadata', { url });
              return;
            }

            bareChatInputLogger.log('link metadata', { linkMetadata });

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
              } else {
                const fileType = linkMetadata.mime.split('/')[1];
                const fileName = url.split('/').pop();

                addAttachment({
                  type: 'link',
                  url: url,
                  title: fileName,
                  description: fileType,
                });
              }
            }
          })
        )
      ).finally(() => {
        if (currentSession === inputSessionRef.current) {
          setLinkMetaLoading(false);
        }
      });
    }

    prevUrlsRef.current = currentUrls;
  }, [debouncedText, store, addAttachment, removeAttachment]);

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

  const setInputFromDraft = useCallback(
    (draft: JSONContent | null) => {
      if (!draft?.content?.length) return;

      const { text, mentions } = contentToTextAndMentions(draft);
      setControlledText(text);
      setMentions(mentions);
      setEditorIsEmpty(false);
      setHasSetInitialContent(true);
      setNeedsHeightAdjustmentAfterLoad(true);
    },
    [setMentions]
  );

  const reloadDraft = useCallback(async () => {
    try {
      const draft = await getDraft();
      if (!editingPost) setInputFromDraft(draft);
      inputRef.current?.focus();
    } catch (e) {
      bareChatInputLogger.error('Error loading draft', e);
    }
  }, [editingPost, getDraft, setInputFromDraft]);

  useImperativeHandle(
    ref,
    () => ({
      exitFullscreen: () => {},
      startDraft: () => void reloadDraft(),
    }),
    [reloadDraft]
  );

  // Set initial content from draft or post that is being edited
  useEffect(() => {
    if (!hasSetInitialContent) {
      bareChatInputLogger.log('setting initial content');
      try {
        getDraft().then((draft) => {
          bareChatInputLogger.log('got draft', draft);
          if (!editingPost) {
            setInputFromDraft(draft);
          }

          if (editingPost && editingPost.content) {
            const { story, attachments, isEmpty } = hydrateEditPost(
              editingPost,
              'references-media'
            );

            if (isEmpty) {
              setHasSetInitialContent(true);
              return;
            }

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
    setInputFromDraft,
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
    resetMentionMode();
    setMentions([]);
  }, [
    setEditingPost,
    clearDraft,
    clearAttachments,
    initialHeight,
    resetMentionMode,
    setMentions,
  ]);

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
    if (logic.isBotHomeGroupChatChannel(channelId)) {
      db.wayfindingProgress.setValue((prev) => ({
        ...prev,
        tappedBotMention: true,
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
      showBotMentionTooltip={showBotMentionTooltip}
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
        <View position="relative">
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
              ...(isWeb ? ({ outlineStyle: 'none' } as any) : {}),
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
            <View
              height={inputHeight}
              position="absolute"
              top={0}
              left={0}
              right={0}
              pointerEvents="none"
            >
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
        </View>
      </YStack>
    </MessageInputContainer>
  );
}

export default forwardRef(BareChatInput);
