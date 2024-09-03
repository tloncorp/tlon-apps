import * as db from '@tloncorp/shared/dist/db';
import { useCallback, useState } from 'react';
import { Text, XStack, YStack } from 'tamagui';

import AuthorRow from '../AuthorRow';
import { ChatMessageReplySummary } from '../ChatMessage/ChatMessageReplySummary';
import ContentRenderer from '../ContentRenderer';
import { Image } from '../Image';
import Pressable from '../Pressable';
import { SendPostRetrySheet } from '../SendPostRetrySheet';

const IMAGE_HEIGHT = 268;

export default function NotebookPost({
  post,
  onPress,
  onLongPress,
  onPressRetry,
  onPressDelete,
  showReplies = true,
  showAuthor = true,
  smallImage = false,
  smallTitle = false,
  viewMode,
  isHighlighted,
}: {
  post: db.Post;
  onPress?: (post: db.Post) => void;
  onLongPress?: (post: db.Post) => void;
  onPressImage?: (post: db.Post, imageUri?: string) => void;
  onPressRetry?: (post: db.Post) => void;
  onPressDelete?: (post: db.Post) => void;
  detailView?: boolean;
  showReplies?: boolean;
  showAuthor?: boolean;
  smallImage?: boolean;
  smallTitle?: boolean;
  viewMode?: 'activity';
  isHighlighted?: boolean;
}) {
  const [showRetrySheet, setShowRetrySheet] = useState(false);
  const handleLongPress = useCallback(() => {
    onLongPress?.(post);
  }, [post, onLongPress]);

  const handleRetryPressed = useCallback(() => {
    onPressRetry?.(post);
    setShowRetrySheet(false);
  }, [onPressRetry, post]);

  const handleDeletePressed = useCallback(() => {
    onPressDelete?.(post);
    setShowRetrySheet(false);
  }, [onPressDelete, post]);

  const handlePress = useCallback(() => {
    if (post.hidden || post.isDeleted) {
      return;
    }

    if (post.deliveryStatus === 'failed') {
      setShowRetrySheet(true);
      return;
    }

    onPress?.(post);
  }, [post, onPress]);

  if (!post) {
    return null;
  }

  const hasReplies = post.replyCount! > 0;

  return (
    <Pressable
      onPress={handlePress}
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
        {post.hidden || post.isDeleted ? (
          post.hidden ? (
            <Text color="$tertiaryText" fontWeight="$s" fontSize="$l">
              You have hidden or flagged this post.
            </Text>
          ) : post.isDeleted ? (
            <Text color="$tertiaryText" fontWeight="$s" fontSize="$l">
              This post has been deleted.
            </Text>
          ) : null
        ) : (
          <>
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
                fontWeight="$xl"
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
            {showReplies &&
            hasReplies &&
            post.replyCount &&
            post.replyTime &&
            post.replyContactIds ? (
              <ChatMessageReplySummary post={post} paddingLeft={false} />
            ) : null}
            {post.deliveryStatus === 'failed' ? (
              <XStack alignItems="center" justifyContent="flex-end">
                <Text color="$negativeActionText" fontSize="$xs">
                  Message failed to send
                </Text>
              </XStack>
            ) : null}
            <SendPostRetrySheet
              open={showRetrySheet}
              onOpenChange={setShowRetrySheet}
              onPressRetry={handleRetryPressed}
              onPressDelete={handleDeletePressed}
            />
          </>
        )}
      </YStack>
    </Pressable>
  );
}
