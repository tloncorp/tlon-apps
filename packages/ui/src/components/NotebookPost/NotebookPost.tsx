import { makePrettyShortDate } from '@tloncorp/shared/dist';
import * as db from '@tloncorp/shared/dist/db';
import { useCallback, useMemo } from 'react';

import { Image, Text, YStack } from '../../core';
import AuthorRow from '../AuthorRow';
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
  const dateDisplay = useMemo(() => {
    const date = new Date(post.sentAt);

    return makePrettyShortDate(date);
  }, [post.sentAt]);

  const handleLongPress = useCallback(() => {
    onLongPress?.(post);
  }, [post, onLongPress]);

  if (!post) {
    return null;
  }

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
        paddingVertical="$3xl"
        paddingHorizontal="$2xl"
        borderWidth={1}
        borderRadius="$xl"
        borderColor="$shadow"
        marginVertical="$xl"
        width={viewMode === 'activity' ? 256 : undefined}
        overflow={viewMode === 'activity' ? 'hidden' : undefined}
      >
        {post.image && (
          <Image
            source={{
              uri: post.image,
            }}
            width="100%"
            height={smallImage ? IMAGE_HEIGHT / 2 : IMAGE_HEIGHT}
            borderRadius="$m"
          />
        )}
        {post.title && (
          <Text
            color="$primaryText"
            fontFamily="$serif"
            fontWeight="$s"
            fontSize={smallTitle || viewMode === 'activity' ? '$l' : '$xl'}
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
        <Text
          color="$tertiaryText"
          fontWeight="$s"
          fontSize={smallTitle ? '$s' : '$l'}
        >
          {dateDisplay}
        </Text>
        {showReplies && (
          <Text
            color="$tertiaryText"
            fontWeight="$s"
            fontSize={viewMode === 'activity' ? '$s' : '$l'}
          >
            {post.replyCount} replies
          </Text>
        )}
      </YStack>
    </Pressable>
  );
}
