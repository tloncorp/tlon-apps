// import { EditorBridge } from '@10play/tentap-editor';
import * as db from '@tloncorp/shared/db';
import { Story, Verse, constructStory } from '@tloncorp/shared/urbit';
import { Icon } from '@tloncorp/ui';
import { Image } from '@tloncorp/ui';
import {
  ChangeEvent,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { TextareaHTMLAttributes } from 'react';
import { TouchableOpacity } from 'react-native-gesture-handler';
// TODO: replace input with our own input component
import { Input, View, YStack, getTokenValue } from 'tamagui';

import { markdownToStory } from '../../utils/markdown';
import { ImageAttachment, useAttachmentContext } from '../contexts/attachment';
import AttachmentSheet from './AttachmentSheet';
import { useRegisterChannelHeaderItem } from './Channel/ChannelHeader';
import { MessageInputProps } from './MessageInput/MessageInputBase';
import { ScreenHeader } from './ScreenHeader';

const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>((props, ref) => {
  return (
    <textarea
      {...props}
      ref={ref}
      style={{
        width: '100%',
        height: '100%',
        padding: '12px',
        border: 'none',
        outline: 'none',
        fontSize: '14px',
        fontFamily: 'monospace',
        resize: 'none',
        backgroundColor: 'transparent',
        ...props.style,
      }}
    />
  );
});

// Extract text from a post content
function getTextFromPost(post?: db.Post): string {
  if (!post || !post.content) return '';

  try {
    // Ensure content is actually an array before mapping
    if (Array.isArray(post.content)) {
      return post.content
        .map((verse: Verse) => {
          if ('inline' in verse) {
            return verse.inline
              .map((item) => {
                if (typeof item === 'string') return item;
                // Handle other inline types like bold, etc. as needed
                return '';
              })
              .join('');
          }
          return '';
        })
        .join('\n\n');
    }
    return '';
  } catch (error) {
    console.error('Error parsing post content:', error);
    return '';
  }
}

export function BigInput({
  channelType,
  channelId,
  groupMembers,
  shouldBlur,
  setShouldBlur,
  send,
  storeDraft,
  clearDraft,
  getDraft,
  editingPost,
  setEditingPost,
  editPost,
  setShowBigInput,
  placeholder = "What's on your mind?",
}: {
  channelType: db.ChannelType;
} & MessageInputProps) {
  const [title, setTitle] = useState(editingPost?.title ?? '');
  const [text, setText] = useState('');
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const titleInputHeight = getTokenValue('$4xl', 'size');
  const imageButtonHeight = getTokenValue('$4xl', 'size');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { attachments, attachAssets } = useAttachmentContext();
  const imageAttachment = useMemo(() => {
    if (attachments.length > 0) {
      return attachments.find(
        (attachment): attachment is ImageAttachment =>
          attachment.type === 'image'
      );
    }

    if (editingPost?.image) {
      return {
        type: 'image',
        file: {
          uri: editingPost.image,
          width: 0,
          height: 0,
        },
      };
    }

    return null;
  }, [attachments, editingPost]);

  // Load draft content or editing post content
  useMemo(() => {
    const loadContent = async () => {
      if (editingPost) {
        // Extract plain text from the post content
        setText(getTextFromPost(editingPost));
      } else {
        // Try to load draft
        const draft = await getDraft();
        if (draft && typeof draft === 'string') {
          setText(draft);
        } else if (draft && typeof draft === 'object') {
          // Try to extract text from structured draft
          try {
            let extractedText = '';
            if ('content' in draft && Array.isArray(draft.content)) {
              extractedText = draft.content
                .filter(
                  (node) =>
                    node.type === 'paragraph' &&
                    'content' in node &&
                    Array.isArray(node.content)
                )
                .flatMap((node) =>
                  'content' in node && Array.isArray(node.content)
                    ? node.content.filter(
                        (content) =>
                          content &&
                          typeof content === 'object' &&
                          'type' in content &&
                          content.type === 'text'
                      )
                    : []
                )
                .map((textNode) =>
                  textNode && typeof textNode === 'object' && 'text' in textNode
                    ? String(textNode.text)
                    : ''
                )
                .filter((text) => text)
                .join('\n\n');
            }

            if (extractedText) {
              setText(extractedText);
            }
          } catch (error) {
            console.error('Error parsing draft content:', error);
          }
        }
      }
    };

    loadContent();
  }, [editingPost, getDraft]);

  // Handle sending the post
  const handleSend = useCallback(async () => {
    if (isSending || !text.trim()) return;

    try {
      setIsSending(true);

      // Convert markdown text to Story structure
      const story = markdownToStory(text);

      let metadata: db.PostMetadata | undefined;

      // Add title and image for notebook posts
      if (channelType === 'notebook') {
        metadata = {
          title: title,
          image: imageAttachment?.file.uri,
        };
      }

      if (editingPost && editPost) {
        // Edit existing post
        await editPost(editingPost, story, undefined, metadata);
      } else {
        // Send new post
        await send(story, channelId, metadata);
      }

      // Clear the input and close
      setText('');
      setTitle('');
      setShowBigInput?.(false);
      await clearDraft();
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  }, [
    isSending,
    text,
    title,
    channelType,
    imageAttachment,
    editingPost,
    editPost,
    send,
    channelId,
    setShowBigInput,
    clearDraft,
  ]);

  // Save draft when text changes
  const handleTextChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
    },
    []
  );

  // Save draft when editor loses focus
  const handleBlur = useCallback(() => {
    if (text.trim()) {
      // Use JSONContent object pattern expected by storeDraft
      storeDraft({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
      });
    }
  }, [text, storeDraft]);

  // Determine if post button should be enabled
  const canPost = useMemo(() => {
    if (!text.trim()) return false;
    if (channelType === 'notebook' && !title.trim()) return false;
    return true;
  }, [text, channelType, title]);

  // Register the Post button in the header
  useRegisterChannelHeaderItem(
    useMemo(
      () => (
        <ScreenHeader.TextButton
          key="post-button"
          onPress={handleSend}
          disabled={!canPost || isSending}
          testID="PostButton"
        >
          {isSending ? 'Posting...' : editingPost ? 'Save' : 'Post'}
        </ScreenHeader.TextButton>
      ),
      [canPost, isSending, handleSend, editingPost]
    )
  );

  return (
    <YStack height="100%" width="100%">
      {channelType === 'notebook' && (
        <View
          position="absolute"
          top={0}
          left={0}
          width="100%"
          height={imageButtonHeight}
          zIndex={10}
        >
          <TouchableOpacity
            onPress={() => {
              setShowAttachmentSheet(true);
              textareaRef.current?.blur();
            }}
          >
            {imageAttachment ? (
              <Image
                source={{
                  uri: imageAttachment.file.uri,
                }}
                contentFit="cover"
                height={imageButtonHeight}
                style={{
                  width: '100%',
                  borderBottomLeftRadius: 16,
                  borderBottomRightRadius: 16,
                }}
              />
            ) : (
              <View
                backgroundColor="$primaryText"
                width="100%"
                height={imageButtonHeight}
                borderBottomLeftRadius="$xl"
                borderBottomRightRadius="$xl"
                padding="$2xl"
                alignItems="center"
                justifyContent="center"
                gap="$l"
              >
                <Icon type="Camera" color="$background" />
              </View>
            )}
          </TouchableOpacity>
          <View backgroundColor="$background" width="100%">
            <Input
              size="$xl"
              height={titleInputHeight}
              backgroundColor="$background"
              borderColor="transparent"
              placeholder="New Title"
              onChangeText={setTitle}
              value={title}
            />
          </View>
        </View>
      )}
      <View
        paddingTop={
          channelType === 'notebook' ? titleInputHeight + imageButtonHeight : 0
        }
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          position: 'relative',
        }}
      >
        <View style={{ flex: 1, paddingHorizontal: 16 }}>
          <Textarea
            ref={textareaRef}
            placeholder={placeholder}
            value={text}
            onChange={handleTextChange}
            onBlur={handleBlur}
          />
        </View>
      </View>

      {channelType === 'notebook' && showAttachmentSheet && (
        <AttachmentSheet
          isOpen={showAttachmentSheet}
          onOpenChange={setShowAttachmentSheet}
          onAttachmentsSet={attachAssets}
        />
      )}
    </YStack>
  );
}
