import { makePrettyShortDate } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { ComponentProps, useCallback, useMemo, useState } from 'react';
import {
  View,
  ViewStyle,
  XStack,
  YStack,
  createStyledContext,
  styled,
} from 'tamagui';

import { DetailViewAuthorRow } from '../AuthorRow';
import { ChatMessageReplySummary } from '../ChatMessage/ChatMessageReplySummary';
import { Image } from '../Image';
import { OverflowMenuButton } from '../OverflowMenuButton';
import { createContentRenderer } from '../PostContent/ContentRenderer';
import {
  usePostContent,
  usePostLastEditContent,
} from '../PostContent/contentUtils';
import Pressable from '../Pressable';
import { SendPostRetrySheet } from '../SendPostRetrySheet';
import { Text } from '../TextV2';

const IMAGE_HEIGHT = 268;

export function NotebookPost({
  post,
  onPress,
  onLongPress,
  onPressRetry,
  onPressDelete,
  showReplies = true,
  showAuthor = true,
  showDate = false,
  viewMode,
  size = '$l',
  hideOverflowMenu,
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
  showDate?: boolean;
  viewMode?: 'activity';
  isHighlighted?: boolean;
  size?: '$l' | '$s' | '$xs';
  hideOverflowMenu?: boolean;
}) {
  const [showRetrySheet, setShowRetrySheet] = useState(false);
  const [disableHandlePress, setDisableHandlePress] = useState(false);

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

  const deliveryFailed =
    post.deliveryStatus === 'failed' ||
    post.editStatus === 'failed' ||
    post.deleteStatus === 'failed';

  const handlePress = useCallback(() => {
    if (post.hidden || post.isDeleted) {
      return;
    }

    if (deliveryFailed) {
      setShowRetrySheet(true);
      return;
    }

    onPress?.(post);
  }, [post, onPress, deliveryFailed]);

  const onPressOverflow = useCallback(() => {
    handleLongPress();
  }, [handleLongPress]);

  const onHoverIntoOverflow = useCallback(() => {
    setDisableHandlePress(true);
  }, []);

  const onHoverOutOfOverflow = useCallback(() => {
    setDisableHandlePress(false);
  }, []);

  if (!post || post.isDeleted) {
    return null;
  }

  const hasReplies = post.replyCount && post.replyTime && post.replyContactIds;
  return (
    <Pressable
      onPress={disableHandlePress ? undefined : handlePress}
      onLongPress={handleLongPress}
      pressStyle={{ backgroundColor: '$secondaryBackground' }}
      borderRadius="$l"
    >
      <NotebookPostFrame size={size} disabled={viewMode === 'activity'}>
        {post.hidden ? (
          <XStack
            gap="$s"
            paddingVertical="$xl"
            justifyContent="center"
            alignItems="center"
          >
            <Text color="$tertiaryText" size="$body">
              You have hidden this post.
            </Text>
          </XStack>
        ) : (
          <>
            <NotebookPostHeader
              post={post}
              showDate={showDate}
              showAuthor={showAuthor && viewMode !== 'activity'}
              size={size}
            />

            {viewMode !== 'activity' && (
              <Text
                size="$body"
                color="$secondaryText"
                numberOfLines={3}
                paddingBottom={showReplies && hasReplies ? 0 : '$m'}
              >
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
          </>
        )}

        {post.deliveryStatus === 'failed' ? (
          <XStack alignItems="center" justifyContent="flex-end">
            <Text color="$negativeActionText" fontSize="$xs">
              Message failed to send
            </Text>
          </XStack>
        ) : null}
        {!hideOverflowMenu && (
          <OverflowMenuButton
            onPress={onPressOverflow}
            onHoverIn={onHoverIntoOverflow}
            onHoverOut={onHoverOutOfOverflow}
          />
        )}
      </NotebookPostFrame>
      <SendPostRetrySheet
        open={showRetrySheet}
        post={post}
        onOpenChange={setShowRetrySheet}
        onPressRetry={handleRetryPressed}
        onPressDelete={handleDeletePressed}
      />
    </Pressable>
  );
}

function NotebookPostHeader({
  showDate,
  showAuthor,
  post,
  size,
  ...props
}: {
  showAuthor?: boolean;
  showDate?: boolean;
  post: db.Post;
  size?: '$l' | '$s' | '$xs';
} & ComponentProps<typeof NotebookPostHeaderFrame>) {
  const formattedDate = useMemo(() => {
    return makePrettyShortDate(new Date(post.receivedAt));
  }, [post.receivedAt]);

  return (
    <NotebookPostHeaderFrame {...props}>
      {!!post.image && size !== '$xs' && (
        <NotebookPostHeroImage
          source={{
            uri:
              post.editStatus === 'failed' || post.editStatus === 'pending'
                ? post.lastEditImage ?? undefined
                : post.image,
          }}
        />
      )}

      <NotebookPostTitle>
        {post.editStatus === 'failed' || post.editStatus === 'pending'
          ? post.lastEditTitle ?? 'Untitled Post'
          : post.title ?? 'Untitled Post'}
      </NotebookPostTitle>

      {showDate && (
        <Text size="$body" color="$tertiaryText">
          {formattedDate}
        </Text>
      )}

      {showAuthor && (
        <DetailViewAuthorRow
          authorId={post.authorId}
          deliveryStatus={post.deliveryStatus}
          editStatus={post.editStatus}
          deleteStatus={post.deleteStatus}
        />
      )}
    </NotebookPostHeaderFrame>
  );
}

export function NotebookPostDetailView({ post }: { post: db.Post }) {
  const content = usePostContent(post);
  const lastEditContent = usePostLastEditContent(post);

  return (
    <NotebookPostFrame
      embedded
      paddingHorizontal={0}
      paddingTop={post.image ? '$xl' : '$2xl'}
    >
      <NotebookPostHeader
        post={post}
        showDate
        showAuthor
        paddingHorizontal={'$xl'}
        paddingBottom={'$2xl'}
        borderBottomWidth={1}
        borderBottomColor="$border"
      />
      <NotebookContentRenderer
        marginTop="$-l"
        marginHorizontal="$-l"
        paddingHorizontal="$xl"
        content={
          post.editStatus === 'failed' || post.editStatus === 'pending'
            ? lastEditContent
            : content
        }
      />
    </NotebookPostFrame>
  );
}

const NotebookLineBreak = () => `\n\n`;

const NotebookContentRenderer = createContentRenderer({
  inlineRenderers: {
    lineBreak: NotebookLineBreak,
  },
});

const NotebookPostContext = createStyledContext<{ size: '$l' | '$s' }>({
  size: '$l',
});

const NotebookPostFrame = styled(View, {
  name: 'NotebookPostFrame',
  context: NotebookPostContext,
  borderWidth: 1,
  borderColor: '$border',
  borderRadius: '$l',
  gap: '$2xl',
  padding: '$xl',
  variants: {
    embedded: {
      true: {
        borderWidth: 0,
        borderRadius: 0,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '$border',
        paddingBottom: '$l',
      },
    },
    size: {} as Record<'$s' | '$l' | '$xs', ViewStyle>,
  } as const,
});

const NotebookPostHeaderFrame = styled(YStack, {
  name: 'NotebookHeaderFrame',
  gap: '$2xl',
  overflow: 'hidden',
});

export const NotebookPostHeroImage = styled(Image, {
  context: NotebookPostContext,
  width: '100%',
  height: IMAGE_HEIGHT,
  borderRadius: '$s',
  variants: {
    size: {
      $s: {
        height: IMAGE_HEIGHT / 2,
      },
    },
  } as const,
});

export const NotebookPostTitle = styled(Text, {
  context: NotebookPostContext,
  color: '$primaryText',
  size: '$title/l',
  variants: {
    size: {
      $s: '$label/2xl',
    },
  } as const,
});
