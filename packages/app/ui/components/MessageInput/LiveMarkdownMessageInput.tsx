import type { MarkdownStyle } from '@expensify/react-native-live-markdown';
import { JSONContent, Story } from '@tloncorp/api/urbit';
import {
  Attachment,
  createDevLogger,
  extractContentTypesFromPost,
  inlinesToMarkdown,
  markdownToStory,
  storyToContent,
  tiptap,
  uploadAsset as uploadAssetToStorage,
  waitForUploads,
} from '@tloncorp/shared';
import type * as db from '@tloncorp/shared/db';
import type * as domain from '@tloncorp/shared/domain';
import { useToast } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NativeSyntheticEvent,
  TextInput,
  TextInputContentSizeChangeEventData,
  TextInputSelectionChangeEventData,
} from 'react-native';
import { XStack, YStack, useTheme } from 'tamagui';

import { useAttachmentContext } from '../../contexts/attachment';
import {
  ALL_MENTION_ID,
  MentionOption,
  createMentionRoleOptions,
  useMentions,
} from '../BareChatInput/useMentions';
import { AttachmentPreviewList } from './AttachmentPreviewList';
import { LiveMarkdownInput, PastedImage } from './LiveMarkdownInput';
import { MessageInputContainer, MessageInputProps } from './MessageInputBase';
import {
  Mention,
  canonicalText,
  mentionsToRanges,
  updateMentions,
} from './liveMarkdownMentions';
import {
  storyToTextAndMentions,
  textAndMentionsToStory,
} from './liveMarkdownMentionsStory';

const liveMarkdownLogger = createDevLogger('LiveMarkdownMessageInput', false);

export const LiveMarkdownMessageInput = ({
  shouldBlur,
  setShouldBlur,
  sendPostFromDraft,
  channelId,
  storeDraft,
  clearDraft,
  getDraft,
  editingPost,
  setEditingPost,
  setShowBigInput,
  showInlineAttachments = true,
  showAttachmentButton = true,
  floatingActionButton = false,
  paddingHorizontal,
  initialHeight = 44,
  placeholder = 'Message',
  draftType,
  title,
  image,
  channelType,
  goBack,
  onSend,
  frameless = false,
  bigInput = false,
  groupRoles,
}: MessageInputProps) => {
  const theme = useTheme();
  const showToast = useToast();
  const inputRef = useRef<TextInput>(null);
  const isMountedRef = useRef(true);
  // Latest known cursor/selection, used to splice inserted image markdown.
  const selectionRef = useRef<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });
  const uploadCounterRef = useRef(0);
  const [text, setText] = useState('');
  const [containerHeight, setContainerHeight] = useState(initialHeight);
  const [hasSetInitialContent, setHasSetInitialContent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const lastEditingPost = useRef<db.Post | undefined>(editingPost);

  const { attachments, clearAttachments } = useAttachmentContext();

  const [selection, setSelection] = useState<
    { start: number; end: number } | undefined
  >(undefined);

  const roleOptions = useMemo(
    () => createMentionRoleOptions(groupRoles ?? []),
    [groupRoles]
  );

  // Slack-style entity mentions: each picked/loaded mention is tracked by span.
  // Only these spans highlight (so a typed duplicate stays plain) and only these
  // become mention inlines on send.
  const [mentions, setMentions] = useState<Mention[]>([]);
  const mentionRanges = useMemo(() => mentionsToRanges(mentions), [mentions]);

  const {
    isMentionModeActive,
    mentionSearchText,
    validOptions,
    mentionStartIndex,
    handleMention,
    resetMentionMode,
  } = useMentions({ chatId: channelId, roleOptions });

  const markdownStyle = useMemo<MarkdownStyle>(
    () => ({
      mentionUser: {
        color: theme.positiveActionText.val,
        backgroundColor: theme.positiveBackground.val,
      },
      mentionHere: {
        color: theme.positiveActionText.val,
        backgroundColor: theme.positiveBackground.val,
      },
    }),
    [theme]
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const editorIsEmpty =
    (text.trim().length === 0 || text.trim() === '\n') &&
    attachments.length === 0;

  useEffect(() => {
    if (editingPost && lastEditingPost.current?.id !== editingPost.id) {
      lastEditingPost.current = editingPost;
      setHasSetInitialContent(false);
    }
  }, [editingPost]);

  useEffect(() => {
    if (hasSetInitialContent) {
      return;
    }

    (async () => {
      if (editingPost?.content) {
        const { story } = extractContentTypesFromPost(editingPost);
        if (story) {
          const seeded = storyToTextAndMentions(story as unknown[]);
          setText(seeded.text);
          setMentions(seeded.mentions);
        } else {
          setText('');
        }
        setHasSetInitialContent(true);
        return;
      }

      const draft = await getDraft(draftType);
      if (draft) {
        const inlines = tiptap.JSONToInlines(draft as JSONContent);
        setText(inlinesToMarkdown(inlines as any));
      }
      setHasSetInitialContent(true);
    })().catch((e) => {
      liveMarkdownLogger.error('Failed to load draft content', e);
    });
  }, [draftType, editingPost, getDraft, hasSetInitialContent]);

  useEffect(() => {
    if (!hasSetInitialContent) {
      return;
    }

    if (text.trim().length === 0) {
      clearDraft(draftType);
      return;
    }

    const story = markdownToStory(text);
    const json = tiptap.diaryMixedToJSON(story);
    storeDraft(json, draftType).catch((e) => {
      liveMarkdownLogger.error('Failed to store markdown draft', e);
    });
  }, [text, hasSetInitialContent, storeDraft, clearDraft, draftType]);

  useEffect(() => {
    if (shouldBlur) {
      inputRef.current?.blur();
      setShouldBlur(false);
    }
  }, [shouldBlur, setShouldBlur]);

  const handleSend = useCallback(
    async (isEdit?: boolean) => {
      try {
        setIsSending(true);
        const story = textAndMentionsToStory(
          text,
          mentions
        ) as unknown as Story;
        const content = storyToContent(story);

        const draft: domain.PostDataDraft = {
          channelId,
          content,
          attachments,
          channelType,
          title,
          image: image?.uri,
          replyToPostId: null,
          ...(isEdit && editingPost != null
            ? { isEdit: true, editTargetPostId: editingPost.id }
            : { isEdit: false }),
        };

        await sendPostFromDraft(draft);

        setEditingPost?.(undefined);
        onSend?.();
        setText('');
        setMentions([]);
        clearAttachments();
        clearDraft(draftType);
        setShowBigInput?.(false);
      } catch (e) {
        liveMarkdownLogger.error('Failed to send markdown message', e);
        setSendError(true);
      } finally {
        setIsSending(false);
        setSendError(false);
      }
    },
    [
      text,
      mentions,
      channelId,
      attachments,
      channelType,
      title,
      image,
      editingPost,
      sendPostFromDraft,
      setEditingPost,
      onSend,
      clearAttachments,
      clearDraft,
      draftType,
      setShowBigInput,
    ]
  );

  const handleCancelEditing = useCallback(() => {
    setEditingPost?.(undefined);
    setHasSetInitialContent(false);
    setText('');
    setMentions([]);
    clearDraft(draftType);
    clearAttachments();
  }, [setEditingPost, clearDraft, clearAttachments, draftType]);

  const handleChangeText = useCallback(
    (next: string) => {
      handleMention(text, next);
      setMentions((prev) => updateMentions(prev, text, next));
      setText(next);
    },
    [text, handleMention]
  );

  const handleSelectionChange = useCallback(
    (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      selectionRef.current = event.nativeEvent.selection;
      // Release the one-shot controlled selection set after inserting a mention,
      // so the caret is free to move on the next interaction.
      setSelection((prev) => (prev ? undefined : prev));
    },
    []
  );

  const insertAtSelection = useCallback((insertion: string) => {
    setText((prev) => {
      const { start, end } = selectionRef.current;
      const safeStart = Math.min(Math.max(start, 0), prev.length);
      const safeEnd = Math.min(Math.max(end, safeStart), prev.length);
      const next = prev.slice(0, safeStart) + insertion + prev.slice(safeEnd);
      const caret = safeStart + insertion.length;
      selectionRef.current = { start: caret, end: caret };
      return next;
    });
  }, []);

  // Insert a placeholder, upload the image, then swap the placeholder for the
  // final image markdown. Mirrors the enriched editor's paste/insert flow.
  const uploadAndInsertImage = useCallback(
    async (asset: PastedImage) => {
      const id = (uploadCounterRef.current += 1);
      const placeholder = `⟳ uploading image #${id}…`;
      insertAtSelection(`${placeholder}\n`);

      const replacePlaceholder = (replacement: string) => {
        setText((prev) => prev.replace(placeholder, replacement));
      };

      try {
        const uploadIntent = Attachment.UploadIntent.fromImagePickerAsset({
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          mimeType: asset.type,
        } as any);
        await uploadAssetToStorage(uploadIntent, true);

        if (!isMountedRef.current) return;

        const uploadStates = await waitForUploads([
          Attachment.UploadIntent.extractKey(uploadIntent),
        ]);

        if (!isMountedRef.current) return;

        const uploadState = uploadStates[asset.uri];
        if (uploadState?.status === 'success') {
          replacePlaceholder(`![](${uploadState.remoteUri})`);
        } else {
          replacePlaceholder('');
          liveMarkdownLogger.trackError('live-markdown:image:upload-failure', {
            uploadState,
          });
          showToast({
            message: 'Failed to upload image. Please try again.',
            duration: 3000,
          });
        }
      } catch (error) {
        if (isMountedRef.current) {
          replacePlaceholder('');
          liveMarkdownLogger.trackError('live-markdown:image:upload-error', {
            error,
          });
          showToast({ message: 'Error uploading image.', duration: 3000 });
        }
      }
    },
    [insertAtSelection, showToast]
  );

  const handlePasteImages = useCallback(
    (event: NativeSyntheticEvent<{ images: PastedImage[] }>) => {
      event.nativeEvent.images.forEach((img) => {
        uploadAndInsertImage(img);
      });
    },
    [uploadAndInsertImage]
  );

  const onSelectMention = useCallback(
    (option: MentionOption) => {
      if (mentionStartIndex == null) {
        return;
      }
      const inline =
        option.type === 'contact'
          ? { ship: option.id.replace(/^~/, '') }
          : { sect: option.id === ALL_MENTION_ID ? null : option.id };
      const canonical = canonicalText(inline);
      const before = text.slice(0, mentionStartIndex);
      const after = text.slice(
        mentionStartIndex + 1 + mentionSearchText.length
      );
      const inserted = `${canonical} `;
      const newText = before + inserted + after;
      const caret = before.length + inserted.length;
      const newMention: Mention = {
        start: before.length,
        length: canonical.length,
        inline,
      };
      // Reposition existing mentions for the insertion, then add the new one.
      setMentions((prev) => [
        ...updateMentions(prev, text, newText),
        newMention,
      ]);
      setText(newText);
      setSelection({ start: caret, end: caret });
      resetMentionMode();
    },
    [text, mentionStartIndex, mentionSearchText, resetMentionMode]
  );

  return (
    <MessageInputContainer
      setShouldBlur={setShouldBlur}
      onPressSend={() => handleSend(false)}
      onPressEdit={() => handleSend(true)}
      containerHeight={containerHeight}
      sendError={sendError}
      mentionOptions={validOptions}
      onSelectMention={onSelectMention}
      isMentionModeActive={isMentionModeActive}
      mentionText={mentionSearchText}
      isEditing={!!editingPost}
      cancelEditing={handleCancelEditing}
      showAttachmentButton={showAttachmentButton}
      floatingActionButton={floatingActionButton}
      disableSend={
        editorIsEmpty || (channelType === 'notebook' && !title) || isSending
      }
      goBack={goBack}
      frameless={frameless}
    >
      <YStack
        flex={1}
        paddingHorizontal={paddingHorizontal}
        borderColor={frameless ? 'transparent' : '$border'}
        borderWidth={frameless ? 0 : 1}
        borderRadius={frameless ? 0 : '$xl'}
        paddingTop={frameless ? '$s' : undefined}
      >
        {showInlineAttachments && <AttachmentPreviewList />}
        <XStack
          {...(bigInput ? { flex: 1 } : { height: containerHeight })}
          style={{ width: '100%' }}
        >
          <LiveMarkdownInput
            ref={inputRef}
            value={text}
            onChangeText={handleChangeText}
            selection={selection}
            onSelectionChange={handleSelectionChange}
            onPasteImages={handlePasteImages}
            markdownStyle={markdownStyle}
            mentionRanges={mentionRanges}
            placeholder={placeholder}
            style={{
              flex: 1,
              width: '100%',
              color: theme.primaryText.val,
              backgroundColor: theme.background.val,
              fontSize: 16,
            }}
            multiline
            onContentSizeChange={(
              event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>
            ) => {
              const nextHeight = Math.max(
                initialHeight,
                event.nativeEvent.contentSize.height
              );
              setContainerHeight(nextHeight);
            }}
          />
        </XStack>
      </YStack>
    </MessageInputContainer>
  );
};

LiveMarkdownMessageInput.displayName = 'LiveMarkdownMessageInput';
