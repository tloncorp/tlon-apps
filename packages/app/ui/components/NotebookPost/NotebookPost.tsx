import { ChannelAction, makePrettyShortDate } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Image } from '@tloncorp/ui';
import { Button } from '@tloncorp/ui';
import { Icon } from '@tloncorp/ui';
import { Pressable } from '@tloncorp/ui';
import { Text } from '@tloncorp/ui';
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

import { useChannelContext } from '../../contexts';
import { MinimalRenderItemProps } from '../../contexts/componentsKits';
import { DetailViewAuthorRow } from '../AuthorRow';
import { ChatMessageActions } from '../ChatMessage/ChatMessageActions/Component';
import { ChatMessageReplySummary } from '../ChatMessage/ChatMessageReplySummary';
import { createContentRenderer } from '../PostContent/ContentRenderer';
import {
  usePostContent,
  usePostLastEditContent,
} from '../PostContent/contentUtils';
import { SendPostRetrySheet } from '../SendPostRetrySheet';

const IMAGE_HEIGHT = 268;

export function NotebookPost({
  post,
  onPress,
  onPressEdit,
  onLongPress,
  onPressRetry,
  onPressDelete,
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
  const [showRetrySheet, setShowRetrySheet] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [overFlowIsHovered, setOverFlowIsHovered] = useState(false);
  const channel = useChannelContext();
  const postActionIds = useMemo(
    () => ChannelAction.channelActionIdsFor({ channel }),
    [channel]
  );

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

  const onHoverIn = useCallback(() => {
    setIsHovered(true);
  }, []);

  const onHoverOut = useCallback(() => {
    setIsHovered(false);
  }, []);

  const onOverflowHoverIn = useCallback(() => {
    setOverFlowIsHovered(true);
  }, []);

  const onOverflowHoverOut = useCallback(() => {
    setOverFlowIsHovered(false);
  }, []);

  if (!post || post.isDeleted) {
    return null;
  }

  const hasReplies = post.replyCount && post.replyTime && post.replyContactIds;
  return (
    <Pressable
      onPress={overFlowIsHovered || isPopoverOpen ? undefined : handlePress}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      onLongPress={handleLongPress}
      pressStyle={{ backgroundColor: '$secondaryBackground' }}
      borderRadius="$l"
      maxWidth={600}
      width={'100%'}
      marginHorizontal="auto"
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
        {!hideOverflowMenu && (isPopoverOpen || isHovered) && (
          <View position="absolute" top={12} right={12}>
            <ChatMessageActions
              post={post}
              postActionIds={postActionIds}
              onDismiss={() => {
                setIsPopoverOpen(false);
                setIsHovered(false);
              }}
              onOpenChange={setIsPopoverOpen}
              onEdit={onPressEdit}
              onReply={handlePress}
              trigger={
                <Button
                  backgroundColor="transparent"
                  borderWidth="unset"
                  size="$l"
                  onHoverIn={onOverflowHoverIn}
                  onHoverOut={onOverflowHoverOut}
                >
                  <Icon type="Overflow" />
                </Button>
              }
            />
          </View>
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

export function NotebookPostDetailView({ post }: { post: db.Post }) {
  const content = usePostContent(post);
  const lastEditContent = usePostLastEditContent(post);

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
