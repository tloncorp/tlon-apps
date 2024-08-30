import * as db from '@tloncorp/shared/dist/db';
import { useCallback, useState } from 'react';
import { View, XStack, YStack, styled } from 'tamagui';

import AuthorRow from '../AuthorRow';
import { ChatMessageReplySummary } from '../ChatMessage/ChatMessageReplySummary';
import { Image } from '../Image';
import { SendPostRetrySheet } from '../SendPostRetrySheet';
import { Text } from '../TextV2';

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

  const hasReplies = post.replyCount && post.replyTime && post.replyContactIds;

  return (
    <>
      <View
        borderWidth={1}
        borderColor={'$border'}
        borderRadius="$l"
        onPress={handlePress}
        onLongPress={handleLongPress}
        pressStyle={{ backgroundColor: '$secondaryBackground' }}
        disabled={viewMode === 'activity'}
      >
        <NotebookPostFrame pointerEvents="none">
          {post.hidden ? (
            <Text color="$tertiaryText" fontWeight="$s" fontSize="$l">
              You have hidden or flagged this post.
            </Text>
          ) : post.isDeleted ? (
            <Text color="$tertiaryText" fontWeight="$s" fontSize="$l">
              This post has been deleted.
            </Text>
          ) : (
            // We don't want anything in here to swallow the press event
            <>
              {post.image && (
                <NotebookPostHeroImage
                  source={{
                    uri: post.image,
                  }}
                  small={smallImage}
                />
              )}
              {post.title && (
                <NotebookPostTitle
                  small={smallTitle || viewMode === 'activity'}
                >
                  {post.title}
                </NotebookPostTitle>
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
                <Text size="$body" color="$secondaryText" numberOfLines={3}>
                  {post.textContent}
                </Text>
              )}

              {showReplies && hasReplies ? (
                <ChatMessageReplySummary
                  post={post}
                  showTime={false}
                  textColor="$tertiaryText"
                />
              ) : null}

              {post.deliveryStatus === 'failed' ? (
                <XStack alignItems="center" justifyContent="flex-end">
                  <Text color="$negativeActionText" fontSize="$xs">
                    Message failed to send
                  </Text>
                </XStack>
              ) : null}
            </>
          )}
        </NotebookPostFrame>
      </View>
      <SendPostRetrySheet
        open={showRetrySheet}
        onOpenChange={setShowRetrySheet}
        onPressRetry={handleRetryPressed}
        onPressDelete={handleDeletePressed}
      />
    </>
  );
}

export const NotebookPostFrame = styled(YStack, {
  name: 'NotebookPostFrame',
  gap: '$2xl',
  padding: '$xl',
  overflow: 'hidden',
});

export const NotebookPostHeroImage = styled(Image, {
  width: '100%',
  height: IMAGE_HEIGHT,
  borderRadius: '$s',
  variants: {
    small: {
      true: {
        height: IMAGE_HEIGHT / 2,
      },
    },
  } as const,
});

export const NotebookPostTitle = styled(Text, {
  color: '$primaryText',
  size: '$title/l',
  variants: {
    small: {
      true: '$label/2xl',
    },
  } as const,
});
