import { extractContentTypesFromPost } from '@tloncorp/shared';
import { contentReferenceToCite } from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import {
  Block,
  Story,
  citeToPath,
  pathToCite,
} from '@tloncorp/shared/dist/urbit';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getFontSize } from 'tamagui';
import { Text, View, YStack, getToken, useWindowDimensions } from 'tamagui';

import {
  Attachment,
  UploadedImageAttachment,
  useAttachmentContext,
} from '../contexts';
import { DEFAULT_MESSAGE_INPUT_HEIGHT } from './MessageInput';
import { AttachmentPreviewList } from './MessageInput/AttachmentPreviewList';
import {
  MessageInputContainer,
  MessageInputProps,
} from './MessageInput/MessageInputBase';

interface Mention {
  id: string;
  display: string;
  start: number;
  end: number;
}

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
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [hasSetInitialContent, setHasSetInitialContent] = useState(false);
  const [editorIsEmpty, setEditorIsEmpty] = useState(attachments.length === 0);
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [hasAutoFocused, setHasAutoFocused] = useState(false);
  const [mentionStartIndex, setMentionStartIndex] = useState<number | null>(
    null
  );
  const [mentionSearchText, setMentionSearchText] = useState<string>('');
  const [maxInputHeight, setMaxInputHeight] = useState(maxInputHeightBasic);
  const inputRef = useRef<TextInput>(null);

  const handleTextChange = (newText: string) => {
    const oldText = text;
    setText(newText);

    // Check if we're deleting a trigger symbol
    if (newText.length < oldText.length && showMentionPopup) {
      const deletedChar = oldText[newText.length];
      if (deletedChar === '@' || deletedChar === '~') {
        setShowMentionPopup(false);
        setMentionStartIndex(null);
        setMentionSearchText('');
        return;
      }
    }

    // Check for @ symbol
    const lastAtSymbol = newText.lastIndexOf('@');
    if (lastAtSymbol >= 0 && lastAtSymbol === newText.length - 1) {
      setShowMentionPopup(true);
      setMentionStartIndex(lastAtSymbol);
      setMentionSearchText('');
    } else if (showMentionPopup && mentionStartIndex !== null) {
      // Update mention search text
      const searchText = newText.slice(mentionStartIndex + 1);
      if (!searchText.includes(' ')) {
        setMentionSearchText(searchText);
      } else {
        setShowMentionPopup(false);
        setMentionStartIndex(null);
        setMentionSearchText('');
      }
    }

    // Check for ~ symbol
    const lastSig = newText.lastIndexOf('~');
    if (lastSig >= 0 && lastSig === newText.length - 1) {
      setShowMentionPopup(true);
      setMentionStartIndex(lastSig);
      setMentionSearchText('');
    } else if (showMentionPopup && mentionStartIndex !== null) {
      // Update mention search text
      const searchText = newText.slice(mentionStartIndex + 1);
      if (!searchText.includes(' ')) {
        setMentionSearchText(searchText);
      } else {
        setShowMentionPopup(false);
        setMentionStartIndex(null);
        setMentionSearchText('');
      }
    }

    // Update mention positions when text changes
    if (mentions.length > 0) {
      const updatedMentions = mentions.filter(
        (mention) =>
          mention.start <= newText.length &&
          newText.slice(mention.start, mention.end) === mention.display
      );
      if (updatedMentions.length !== mentions.length) {
        setMentions(updatedMentions);
      }
    }
  };

  const handleSelectMention = useCallback(
    (contact: db.Contact) => {
      if (mentionStartIndex === null) return;

      const mentionDisplay = `${contact.id}`;
      const beforeMention = text.slice(0, mentionStartIndex);
      const afterMention = text.slice(
        mentionStartIndex + (mentionSearchText?.length || 0) + 1
      );

      const newText = beforeMention + mentionDisplay + ' ' + afterMention;
      const newMention: Mention = {
        id: contact.id,
        display: mentionDisplay,
        start: mentionStartIndex,
        end: mentionStartIndex + mentionDisplay.length,
      };

      setText(newText);
      setMentions((prev) => [...prev, newMention]);
      setShowMentionPopup(false);
      setMentionStartIndex(null);
      setMentionSearchText('');

      // Force focus back to input after mention selection
      inputRef.current?.focus();
    },
    [mentionStartIndex, text, mentionSearchText]
  );

  const renderTextWithMentions = useMemo(() => {
    if (!text) {
      return null;
    }

    if (mentions.length === 0) {
      return null;
    }

    const textParts: JSX.Element[] = [];
    let lastIndex = 0;

    mentions
      .sort((a, b) => a.start - b.start)
      .forEach((mention, index) => {
        if (mention.start > lastIndex) {
          textParts.push(
            <Text key={`text-${index}`} color="transparent">
              {text.slice(lastIndex, mention.start)}
            </Text>
          );
        }

        textParts.push(
          <Text
            key={`mention-${mention.id}`}
            color="$positiveActionText"
            backgroundColor="$positiveBackground"
          >
            {mention.display}
          </Text>
        );

        lastIndex = mention.end;
      });

    if (lastIndex < text.length) {
      textParts.push(
        <Text key="text-end" color="transparent">
          {text.slice(lastIndex)}
        </Text>
      );
    }

    return (
      <Text
        minHeight={initialHeight}
        maxHeight={maxInputHeight}
        width="100%"
        paddingHorizontal="$l"
        paddingVertical="$s"
        fontSize="$m"
        lineHeight="$m"
      >
        {textParts}
      </Text>
    );
  }, [mentions, text, initialHeight, maxInputHeight]);

  const sendMessage = useCallback(
    async (isEdit?: boolean) => {
      const story: Story = [];
      // This is where we'll need to parse the text into inlines

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
    ]
  );

  const runSendMessage = useCallback(
    async (isEdit: boolean) => {
      setIsSending(true);
      try {
        await sendMessage(isEdit);
      } catch (e) {
        console.error('failed to send', e);
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
      // messageInputLogger.log('Setting initial content');
      try {
        getDraft().then((draft) => {
          if (!editingPost && draft) {
            // We'll need to parse the draft content here
            // NOTE: drafts are currently stored as tiptap JSONContent
            setEditorIsEmpty(false);
            setHasSetInitialContent(true);
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

            // We'll need to parse the post content here
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
        console.error('Error setting initial content', e);
      }
    }
  }, [
    getDraft,
    hasSetInitialContent,
    editingPost,
    resetAttachments,
    addAttachment,
  ]);

  // Store draft when text changes
  useEffect(() => {
    // NOTE: drafts are currently stored as tiptap JSONContent
    // storeDraft(text);
  }, [text, storeDraft]);

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
      onSelectMention={handleSelectMention}
      isSending={isSending}
      isEditing={!!editingPost}
      cancelEditing={() => setEditingPost?.(undefined)}
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
            paddingVertical: getToken('$s', 'space'),
            fontSize: getFontSize('$m'),
            textAlignVertical: 'center',
            lineHeight: getFontSize('$m') * 1.5,
          }}
          placeholder={placeholder}
        />
        {mentions.length > 0 && (
          <View
            backgroundColor="transparent"
            position="absolute"
            pointerEvents="none"
            justifyContent="center"
          >
            {renderTextWithMentions}
          </View>
        )}
      </YStack>
    </MessageInputContainer>
  );
}