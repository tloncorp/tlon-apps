import * as db from '@tloncorp/shared/db';
import { Verse } from '@tloncorp/shared/urbit';
import { Icon } from '@tloncorp/ui';
import { Image } from '@tloncorp/ui';
import { ImagePickerAsset } from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, XStack, YStack, getTokenValue } from 'tamagui';

import { markdownToStory } from '../../utils/markdown';
import AttachmentSheet from './AttachmentSheet';
import { useRegisterChannelHeaderItem } from './Channel/ChannelHeader';
import { MessageInputProps } from './MessageInput/MessageInputBase';
import { ScreenHeader } from './ScreenHeader';

// Helper function to extract text content from a post
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
                // Handle other inline types if needed
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

export function BigInput(
  props: MessageInputProps & {
    channelType: db.ChannelType;
  }
) {
  const {
    channelType,
    channelId,
    send,
    storeDraft,
    clearDraft,
    getDraft,
    setShowBigInput,
    editingPost,
    editPost,
    placeholder = "What's on your mind?",
  } = props;

  // Type guard to ensure send is defined
  if (!send) {
    throw new Error('send function is required for BigInput');
  }

  const [isPosting, setIsPosting] = useState(false);
  // Initialize text state with the editing post content if available
  const [text, setText] = useState(() => getTextFromPost(editingPost));
  // For notebook posts, add title and image states
  const [title, setTitle] = useState(editingPost?.title || '');
  const [imageUri, setImageUri] = useState<string | null>(
    editingPost?.image || null
  );
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);

  const inputRef = useRef<TextInput>(null);
  const titleInputRef = useRef<TextInput>(null);
  const { bottom } = useSafeAreaInsets();

  // Check if we should show the notebook-specific UI
  const showNotebookUI = channelType === 'notebook';

  // Calculate content padding based on whether notebook UI is shown
  const contentPaddingTop = showNotebookUI ? 24 : 16;

  // Handle clearing the attached header image
  const handleClearImage = useCallback(() => {
    setImageUri(null);
    setShowAttachmentSheet(false);
  }, []);

  // Handle selecting a new header image
  const handleImageSelected = useCallback((assets: ImagePickerAsset[]) => {
    if (assets.length > 0) {
      setImageUri(assets[0].uri);
    }
    setShowAttachmentSheet(false);
  }, []);

  // Update text and title when editing post changes
  useEffect(() => {
    setText(getTextFromPost(editingPost));
    setTitle(editingPost?.title || '');
    setImageUri(editingPost?.image || null);
  }, [editingPost?.id, editingPost?.image]);

  // Handle sending the post
  const handleSend = useCallback(async () => {
    if (isPosting || !text.trim()) return;

    try {
      setIsPosting(true);

      // Convert markdown text to story format
      const story = markdownToStory(text);

      // Prepare metadata for notebook posts
      let metadata: db.PostMetadata | undefined;
      if (showNotebookUI) {
        metadata = {
          title: title,
          image: imageUri,
        };
      }

      // Edit or create post
      if (editingPost && editPost) {
        await editPost(editingPost, story, undefined, metadata);
      } else {
        await send(story, channelId, metadata);
      }

      // Clear the input and close
      setText('');
      setTitle('');
      setImageUri(null);
      setShowBigInput?.(false);
      await clearDraft();
    } catch (error) {
      console.error('Failed to send post:', error);
    } finally {
      setIsPosting(false);
    }
  }, [
    isPosting,
    text,
    title,
    imageUri,
    showNotebookUI,
    editingPost,
    editPost,
    send,
    channelId,
    setShowBigInput,
    clearDraft,
  ]);

  // Save draft when component unmounts or text changes
  useEffect(() => {
    const saveDraft = async () => {
      if (text.trim()) {
        // Create a JSON document structure for the draft
        await storeDraft({
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
        });
      }
    };

    // Save draft when component is unmounted
    return () => {
      saveDraft();
    };
  }, [text, storeDraft]);

  // Load draft on mount
  useEffect(() => {
    const loadDraft = async () => {
      if (!editingPost) {
        try {
          const draft = await getDraft();
          if (draft) {
            // Try to extract text from JSON draft structure
            if (typeof draft === 'string') {
              setText(draft);
            } else if (draft.content && Array.isArray(draft.content)) {
              // Extract text from JSON structure if available
              const extractedText = draft.content
                .filter(
                  (node) =>
                    node.type === 'paragraph' &&
                    node.content &&
                    Array.isArray(node.content)
                )
                .flatMap(
                  (node) =>
                    node.content?.filter(
                      (content) =>
                        content &&
                        typeof content === 'object' &&
                        'type' in content &&
                        content.type === 'text'
                    ) || []
                )
                .map((textNode) =>
                  textNode && typeof textNode === 'object' && 'text' in textNode
                    ? textNode.text
                    : ''
                )
                .filter((text) => text)
                .join('\n\n');

              if (extractedText) {
                setText(extractedText);
              }
            }
          }
        } catch (error) {
          console.error('Error loading draft:', error);
        }
      }
    };

    loadDraft();
  }, [editingPost, getDraft]);

  // Determine if post button should be enabled
  const canPost = useMemo(() => {
    if (!text.trim()) return false;
    if (showNotebookUI && !title.trim()) return false;
    return true;
  }, [text, showNotebookUI, title]);

  // Register the Post button in the header
  useRegisterChannelHeaderItem(
    useMemo(
      () => (
        <ScreenHeader.TextButton
          key="post-button"
          onPress={handleSend}
          disabled={!canPost || isPosting}
          testID="PostButton"
        >
          {isPosting ? 'Posting...' : editingPost ? 'Save' : 'Post'}
        </ScreenHeader.TextButton>
      ),
      [canPost, isPosting, handleSend, editingPost]
    )
  );

  return (
    <YStack height="100%" width="100%">
      {/* Notebook-specific UI for title and image */}
      {showNotebookUI && (
        <YStack paddingHorizontal="$2xl" paddingTop="$l" gap="$m">
          {/* Title input */}
          <TextInput
            ref={titleInputRef}
            value={title}
            onChangeText={setTitle}
            placeholder="Title"
            style={styles.titleInput}
          />

          {/* Image picker button or preview */}
          <XStack height={48} alignItems="center">
            {imageUri ? (
              <XStack
                height="100%"
                borderRadius="$m"
                overflow="hidden"
                alignItems="center"
                gap="$s"
              >
                <Image
                  source={{ uri: imageUri }}
                  style={{ width: 48, height: 48, borderRadius: 8 }}
                />
                <TouchableOpacity onPress={() => setShowAttachmentSheet(true)}>
                  <XStack alignItems="center" gap="$xs">
                    <Icon type="Camera" size="$s" />
                    <View>
                      <Text>Edit header image</Text>
                    </View>
                  </XStack>
                </TouchableOpacity>
              </XStack>
            ) : (
              <TouchableOpacity onPress={() => setShowAttachmentSheet(true)}>
                <XStack alignItems="center" gap="$xs">
                  <Icon type="Camera" size="$s" />
                  <View>
                    <Text>Add header image</Text>
                  </View>
                </XStack>
              </TouchableOpacity>
            )}
          </XStack>
        </YStack>
      )}

      {/* Main content area */}
      <View
        flex={1}
        backgroundColor="$background"
        paddingHorizontal="$2xl"
        paddingTop={contentPaddingTop}
        paddingBottom={bottom}
      >
        <TextInput
          ref={inputRef}
          multiline
          value={text}
          onChangeText={setText}
          style={styles.markdownInput}
          placeholder={placeholder}
        />
      </View>

      {/* Attachment sheet for notebook header images */}
      {showNotebookUI && showAttachmentSheet && (
        <AttachmentSheet
          isOpen={showAttachmentSheet}
          onOpenChange={setShowAttachmentSheet}
          onAttachmentsSet={handleImageSelected}
          showClearOption={!!imageUri}
          onClearAttachments={handleClearImage}
        />
      )}
    </YStack>
  );
}

const styles = StyleSheet.create({
  titleInput: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: 0,
  },
  markdownInput: {
    flex: 1,
    fontFamily: Platform.select({
      android: 'monospace',
      ios: 'Menlo',
      default: 'monospace',
    }),
    fontSize: 14,
    lineHeight: 19,
  },
});
