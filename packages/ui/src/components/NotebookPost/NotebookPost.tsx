import { makePrettyShortDate } from '@tloncorp/shared/dist';
import * as db from '@tloncorp/shared/dist/db';
import { useCallback, useMemo } from 'react';

import { Image, Text, YStack } from '../../core';
import AuthorRow from '../AuthorRow';
import ContentRenderer from '../ContentRenderer';
import Pressable from '../Pressable';

const IMAGE_HEIGHT = 268;

export default function NotebookPost({
  post,
  onPress,
  onLongPress,
  showReplies = true,
  showAuthor = true,
  smallImage = false,
  smallTitle = false,
  viewMode,
}: {
  post: db.Post;
  onPress?: (post: db.Post) => void;
  onLongPress?: (post: db.Post) => void;
  onPressImage?: (post: db.Post, imageUri?: string) => void;
  detailView?: boolean;
  showReplies?: boolean;
  showAuthor?: boolean;
  smallImage?: boolean;
  smallTitle?: boolean;
  viewMode?: 'activity';
}) {
  const handleLongPress = useCallback(() => {
    onLongPress?.(post);
  }, [post, onLongPress]);

  if (!post) {
    return null;
  }

  const hasReplies = post.replyCount! > 0;

  return (
    <Pressable
      onPress={() => onPress?.(post)}
      onLongPress={handleLongPress}
      delayLongPress={250}
      disabled={viewMode === 'activity'}
    >
      <YStack
        key={post.id}
        gap="$l"
        padding="$l"
        borderWidth={1}
        borderRadius="$l"
        borderColor="$border"
        overflow={viewMode === 'activity' ? 'hidden' : undefined}
      >
        {post.image && (
          <Image
            source={{
              uri: post.image,
            }}
            width="100%"
            height={smallImage ? IMAGE_HEIGHT / 2 : IMAGE_HEIGHT}
            borderRadius="$s"
          />
        )}
        {post.title && (
          <Text
            fontWeight={'500'}
            color="$primaryText"
            fontSize={smallTitle || viewMode === 'activity' ? '$l' : 24}
          >
            {post.title}
          </Text>
        )}
        {showAuthor && viewMode !== 'activity' && (
          <AuthorRow
            authorId={post.authorId}
            author={post.author}
            sent={post.sentAt}
            type={post.type}
          />
        )}
        {viewMode !== 'activity' && (
          <ContentRenderer
            viewMode={viewMode}
            shortenedTextOnly={true}
            post={post}
          />
        )}

        {/* TODO: reuse reply stack from Chat messages */}
        {showReplies && hasReplies && (
          <Text color="$tertiaryText" fontSize="$s">
            {post.replyCount} {post.replyCount === 1 ? 'reply' : 'replies'}
          </Text>
        )}
      </YStack>
    </Pressable>
  );
}
