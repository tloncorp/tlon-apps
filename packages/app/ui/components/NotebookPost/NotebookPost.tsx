import { ChannelAction, makePrettyShortDate } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import {
  Button,
  Icon,
  Image,
  Pressable,
  Text,
  useIsWindowNarrow,
} from '@tloncorp/ui';
import {
  ComponentProps,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  View,
  ViewStyle,
  XStack,
  YStack,
  createStyledContext,
  styled,
} from 'tamagui';

import { useBlockedAuthor } from '../../../hooks/useBlockedAuthor';
import { useChannelContext, useCurrentUserId } from '../../contexts';
import { MinimalRenderItemProps } from '../../contexts/componentsKits';
import { useCanWrite } from '../../utils/channelUtils';
import { DetailViewAuthorRow } from '../AuthorRow';
import { ChatMessageActions } from '../ChatMessage/ChatMessageActions/Component';
import { ChatMessageReplySummary } from '../ChatMessage/ChatMessageReplySummary';
import { createContentRenderer } from '../PostContent/ContentRenderer';
import {
  usePostContent,
  usePostLastEditContent,
} from '../PostContent/contentUtils';
import { PostErrorMessage } from '../PostErrorMessage';

const IMAGE_HEIGHT = 268;

export function NotebookPost({
  post,
  onPress,
  onPressEdit,
  onLongPress,
  onPressRetry,
  showReplies = true,
  showAuthor = true,
  showDate = false,
  viewMode,
  size = '$l',
  hideOverflowMenu,
}: MinimalRenderItemProps & {
  detailView?: boolean;
  showDate?: boolean;
  viewMode?: 'activity';
  size?: '$l' | '$s' | '$xs';
  hideOverflowMenu?: boolean;
}) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const isWindowNarrow = useIsWindowNarrow();
  const channel = useChannelContext();
  const currentUserId = useCurrentUserId();
  const canWrite = useCanWrite(channel, currentUserId);
  const postActionIds = useMemo(
    () => ChannelAction.channelActionIdsFor({ channel, canWrite }),
    [channel, canWrite]
  );

  const { isAuthorBlocked, showBlockedContent, handleShowAnyway } =
    useBlockedAuthor(post);

  const handleLongPress = useCallback(() => {
    onLongPress?.(post);
  }, [post, onLongPress]);

  const handleRetryPressed = useCallback(async () => {
    try {
      await onPressRetry?.(post);
    } catch (e) {
      console.error('Failed to retry post', e);
    }
  }, [onPressRetry, post]);

  const handleEditPostPressed = useCallback(() => {
    onPressEdit?.(post);
  }, [onPressEdit, post]);

  const deliveryFailed =
    post.deliveryStatus === 'failed' ||
    post.editStatus === 'failed' ||
    post.deleteStatus === 'failed';

  const handlePress = useCallback(() => {
    if (post.hidden || post.isDeleted) {
      return;
    }

    onPress?.(post);
  }, [post, onPress]);

  const onHoverIn = useCallback(() => {
    setIsHovered(true);
  }, []);

  const onHoverOut = useCallback(() => {
    setIsHovered(false);
  }, []);

  const handleOverflowPress = useCallback(
    (e: { stopPropagation: () => void }) => {
      // Stop propagation to prevent parent onPress from firing
      e.stopPropagation();
    },
    []
  );

  if (!post || post.isDeleted) {
    return null;
  }

  if (isAuthorBlocked && !showBlockedContent) {
    return (
      <PostErrorMessage
        message="Post from a blocked user."
        actionLabel="Show anyway"
        onAction={handleShowAnyway}
        actionTestID="ShowBlockedPostButton"
      />
    );
  }

  const hasReplies = post.replyCount && post.replyTime && post.replyContactIds;
  return (
    <Pressable
      onPress={handlePress}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      onLongPress={handleLongPress}
      pressStyle={{ backgroundColor: '$secondaryBackground' }}
      borderRadius="$l"
      maxWidth={600}
      width={'100%'}
      marginHorizontal="auto"
      testID="Post"
    >
      <NotebookPostFrame size={size} disabled={viewMode === 'activity'}>
        {post.hidden ? (
          <PostErrorMessage message="You have hidden or reported this post." />
        ) : (
          <>
            <NotebookPostHeader
              post={post}
              showDate={showDate}
              showAuthor={showAuthor && viewMode !== 'activity'}
              testID="NotebookPostHeader"
            />

            {viewMode !== 'activity' && (
              <Text
                size="$body"
                color="$secondaryText"
                numberOfLines={3}
                paddingBottom={showReplies && hasReplies ? 0 : '$m'}
                testID="NotebookPostContentSummary"
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

        {deliveryFailed ? (
          <Pressable onPress={handleRetryPressed}>
            <XStack alignItems="center" justifyContent="flex-end">
              <Text color="$negativeActionText" size="$label/m">
                {isWindowNarrow ? 'Tap' : 'Click'} to retry
              </Text>
            </XStack>
          </Pressable>
        ) : null}
        {!hideOverflowMenu && (isPopoverOpen || isHovered) && (
          <Pressable
            position="absolute"
            zIndex={1000}
            top={12}
            right={12}
            onPress={handleOverflowPress}
          >
            <ChatMessageActions
              post={post}
              postActionIds={postActionIds}
              onDismiss={() => {
                setIsPopoverOpen(false);
                setIsHovered(false);
              }}
              onOpenChange={setIsPopoverOpen}
              onEdit={handleEditPostPressed}
              onReply={handlePress}
              mode="await-trigger"
              trigger={
                <Button
                  backgroundColor="$secondaryBackground"
                  borderWidth="unset"
                  size="$l"
                  onPress={handleOverflowPress}
                  testID="MessageActionsTrigger"
                >
                  <Icon type="Overflow" />
                </Button>
              }
            />
          </Pressable>
        )}
      </NotebookPostFrame>
    </Pressable>
  );
}

function NotebookPostHeader({
  showDate,
  showAuthor,
  post,
  ...props
}: {
  showAuthor?: boolean;
  showDate?: boolean;
  post: db.Post;
} & ComponentProps<typeof NotebookPostHeaderFrame>) {
  const { size } = useContext(NotebookPostContext);
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

export function NotebookPostDetailView({
  post,
  onPressImage,
}: {
  post: db.Post;
  onPressImage?: (post: db.Post, uri?: string) => void;
}) {
  const content = usePostContent(post);
  const lastEditContent = usePostLastEditContent(post);

  const handlePressImage = useCallback(
    (src: string) => {
      onPressImage?.(post, src);
    },
    [onPressImage, post]
  );

  return (
    <NotebookPostFrame
      embedded
      paddingHorizontal={0}
      paddingTop={post.image ? '$xl' : '$2xl'}
      width="100%"
      marginHorizontal="auto"
      maxWidth={600}
    >
      <NotebookPostHeader
        post={post}
        showDate
        showAuthor
        paddingHorizontal={'$xl'}
        paddingBottom={'$2xl'}
        borderBottomWidth={1}
        borderBottomColor="$border"
        testID="NotebookPostHeaderDetailView"
      />
      <NotebookContentRenderer
        marginTop="$-l"
        marginHorizontal="$-l"
        paddingHorizontal="$xl"
        testID="NotebookPostContent"
        onPressImage={handlePressImage}
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

export const NotebookContentRenderer = createContentRenderer({
  inlineRenderers: {
    lineBreak: NotebookLineBreak,
  },
});

const NotebookPostContext = createStyledContext<{ size: '$l' | '$s' | '$xs' }>({
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
  objectFit: 'cover',
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
      $s: { size: '$label/2xl' },
      $l: { size: '$title/l' },
      $xs: { size: '$label/xl' },
    },
  } as const,
});
