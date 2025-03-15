import { extractContentTypesFromPost } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import {
  Inline,
  Story,
  constructStory,
  getFirstInline,
  getInlineContent,
  getTextContent,
} from '@tloncorp/shared/urbit';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, YStack, getVariableValue, useTheme } from 'tamagui';

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
  const inputRef = useRef<TextInput>(null);
  const { bottom } = useSafeAreaInsets();

  // Update text when editing post changes
  useEffect(() => {
    setText(getTextFromPost(editingPost));
  }, [editingPost?.id]); // Only update when the post ID changes

  const handlePost = useCallback(async () => {
    if (isPosting || !text.trim()) return;
    setIsPosting(true);
    try {
      const story = constructStory([text]);

      if (editingPost && editPost) {
        // If we're editing, use editPost with the correct parameters
        if (editingPost.parentId) {
          await editPost(editingPost, story, editingPost.parentId, {});
        } else {
          await editPost(editingPost, story, undefined, {});
        }
      } else {
        // If it's a new post, use send
        await send(story, channelId);
      }

      setText('');
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
          disabled={isPosting || !text.trim()}
          testID="PostButton"
        >
          {isPosting ? 'Posting...' : editingPost ? 'Save' : 'Post'}
        </ScreenHeader.TextButton>
      ),
      [isPosting, handlePost, text, editingPost]
    )
  );

  return (
    <YStack height="100%" width="100%">
      <View
        flex={1}
        backgroundColor="$background"
        paddingHorizontal="$2xl"
        paddingTop="$m"
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
    </YStack>
  );
}
