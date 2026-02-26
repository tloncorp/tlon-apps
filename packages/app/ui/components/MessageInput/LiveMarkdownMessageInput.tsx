import {
  JSONContent,
  createDevLogger,
  extractContentTypesFromPost,
  inlinesToMarkdown,
  markdownToStory,
  storyToContent,
  storyToMarkdown,
  tiptap,
} from '@tloncorp/shared';
import type * as db from '@tloncorp/shared/db';
import type * as domain from '@tloncorp/shared/domain';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TextInput } from 'react-native';
import { XStack, YStack, useTheme } from 'tamagui';

import { useAttachmentContext } from '../../contexts/attachment';
import { AttachmentPreviewList } from './AttachmentPreviewList';
import { LiveMarkdownInput } from './LiveMarkdownInput';
import { MessageInputContainer, MessageInputProps } from './MessageInputBase';

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
}: MessageInputProps) => {
  const theme = useTheme();
  const inputRef = useRef<TextInput>(null);
  const [text, setText] = useState('');
  const [containerHeight, setContainerHeight] = useState(initialHeight);
  const [hasSetInitialContent, setHasSetInitialContent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const lastEditingPost = useRef<db.Post | undefined>(editingPost);

  const { attachments, clearAttachments } = useAttachmentContext();

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
        const markdown = story ? storyToMarkdown(story) : '';
        setText(markdown);
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
        const story = markdownToStory(text);
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
    clearDraft(draftType);
    clearAttachments();
  }, [setEditingPost, clearDraft, clearAttachments, draftType]);

  return (
    <MessageInputContainer
      setShouldBlur={setShouldBlur}
      onPressSend={() => handleSend(false)}
      onPressEdit={() => handleSend(true)}
      containerHeight={containerHeight}
      sendError={sendError}
      mentionOptions={[]}
      onSelectMention={() => {}}
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
        <XStack height={containerHeight} style={{ width: '100%' }}>
          <LiveMarkdownInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            style={{
              flex: 1,
              width: '100%',
              color: theme.primaryText.val,
              backgroundColor: theme.background.val,
              fontSize: 16,
            }}
            multiline
            onContentSizeChange={(event) => {
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
