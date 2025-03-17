import { extractContentTypesFromPost } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { constructStory, getTextContent } from '@tloncorp/shared/urbit';
import { Icon } from '@tloncorp/ui';
import { Text } from '@tloncorp/ui';
import { ImagePickerAsset } from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, TextInput, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, XStack, YStack, getVariableValue, useTheme } from 'tamagui';

import { useAttachmentContext } from '../contexts/attachment';
import AttachmentSheet from './AttachmentSheet';
import { useRegisterChannelHeaderItem } from './Channel/ChannelHeader';
import { MessageInputProps } from './MessageInput/MessageInputBase';
import { ScreenHeader } from './ScreenHeader';

// Helper function to extract text from post content
const getTextFromPost = (post: db.Post | undefined): string => {
  if (!post?.content) return '';

  try {
    const { story } = extractContentTypesFromPost(post);
    return getTextContent(story) || '';
  } catch (e) {
    console.error('Error parsing post content:', e);
    return '';
  }
};

export function BigInput(
  props: MessageInputProps & {
    channelType: db.ChannelType;
  }
) {
  const {
    channelType,
    channelId,
    send,
    setShowBigInput,
    editingPost,
    editPost,
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

  const handlePost = useCallback(async () => {
    if (isPosting) return;

    // For notebook posts, require a title
    if (channelType === 'notebook' && !title.trim()) {
      console.error('Notebook posts must have a title');
      return;
    }

    setIsPosting(true);
    try {
      const story = constructStory([text]);

      // Create metadata for notebook posts with title and image
      const metadata: Record<string, any> = {};
      if (channelType === 'notebook') {
        if (title) {
          metadata.title = title;
        }

        // Always include image field for notebooks, even if null
        // This ensures we can clear an image by setting it to null
        metadata.image = imageUri;
      }

      if (editingPost && editPost) {
        // If we're editing, use editPost with the correct parameters
        // We don't actually need the parentId, but it's required
        // to correctly call the editPost function
        await editPost(editingPost, story, undefined, metadata);
      } else {
        // If it's a new post, use send
        await send(story, channelId, metadata);
      }

      setText('');
      setTitle('');
      setShowBigInput?.(false);
    } catch (error) {
      console.error('Error posting:', error);
    } finally {
      setIsPosting(false);
    }
  }, [
    isPosting,
    send,
    editPost,
    channelId,
    text,
    title,
    imageUri,
    channelType,
    setShowBigInput,
    editingPost,
  ]);

  // Register the post button in the header
  useRegisterChannelHeaderItem(
    useMemo(
      () => (
        <ScreenHeader.TextButton
          key="post-button"
          onPress={handlePost}
          // Disable the post button if we're posting or if we're in a notebook and don't have a title
          disabled={isPosting || (channelType === 'notebook' && !title.trim())}
          testID="PostButton"
        >
          {isPosting ? 'Posting...' : editingPost ? 'Save' : 'Post'}
        </ScreenHeader.TextButton>
      ),
      [isPosting, handlePost, editingPost]
    )
  );

  // Calculate if we should show notebook-specific UI
  const showNotebookUI = channelType === 'notebook';

  // Calculate padding for the main content based on whether we have notebook UI
  const contentPaddingTop = showNotebookUI ? '$xl' : '$m';

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
            style={{
              fontSize: 24,
              fontWeight: 'bold',
              padding: 0,
            }}
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
          style={{
            flex: 1,
            fontFamily: Platform.select({
              android: 'monospace',
              ios: 'System-Monospaced',
              default: 'monospace',
            }),
            fontSize: 14,
            lineHeight: 19,
          }}
          placeholder="Share your thoughts..."
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
