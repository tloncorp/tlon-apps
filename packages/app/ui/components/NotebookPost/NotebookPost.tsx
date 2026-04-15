import { ChannelAction } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Button, Pressable, Text, useIsWindowNarrow } from '@tloncorp/ui';
import { useCallback, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { XStack } from 'tamagui';

import { getPostImageViewerId } from '../../../utils/mediaViewer';
import { useCurrentUserId } from '../../contexts/appDataContext';
import { useChannelContext } from '../../contexts/channel';
import type { MinimalRenderItemProps } from '../../contexts/componentsKits/componentsKits';
import { useCanWrite } from '../../utils/channelUtils';
import { ChatMessageActions } from '../ChatMessage/ChatMessageActions/Component';
import { createContentRenderer } from '../PostContent/ContentRenderer';
import {
  usePostContent,
  usePostLastEditContent,
} from '../PostContent/contentUtils';
import { PostModeration } from '../PostModeration';
import { NotebookPostContent } from './NotebookPostContent';
import {
  NotebookPostContentContainer,
  NotebookPostFrame,
  NotebookPostFramePressable,
  NotebookPostHeader,
} from './shared';

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

  const disableLongPress = Platform.OS === 'web';

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

  return (
    <PostModeration post={post} disableBypassHiddenContent>
      {(moderation) => {
        if (moderation === 'deleted') {
          return <PostModeration.Deleted />;
        }
        if (moderation === 'blocked') {
          return <PostModeration.Blocked />;
        }

        return (
          <NotebookPostFramePressable
            onPress={handlePress}
            onHoverIn={onHoverIn}
            onHoverOut={onHoverOut}
            onLongPress={disableLongPress ? undefined : handleLongPress}
            pressStyle={{ backgroundColor: '$secondaryBackground' }}
            borderRadius="$l"
            maxWidth={600}
            width="100%"
            alignSelf="center"
            flex={1}
            testID="Post"
            disabled={viewMode === 'activity'}
          >
            <NotebookPostContentContainer size={size}>
              {moderation === 'hidden' ? (
                <PostModeration.Hidden />
              ) : (
                <NotebookPostContent
                  post={post}
                  showDate={showDate}
                  viewMode={viewMode}
                  showReplies={showReplies}
                  showAuthor={showAuthor}
                />
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
                        icon="Overflow"
                        fill="ghost"
                        type="secondary"
                        size="small"
                        width={32}
                        height={32}
                        borderRadius="$m"
                        testID="MessageActionsTrigger"
                      />
                    }
                  />
                </Pressable>
              )}
            </NotebookPostContentContainer>
          </NotebookPostFramePressable>
        );
      }}
    </PostModeration>
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
      borderTopWidth={post.image ? 1 : 0}
      paddingTop={post.image ? '$xl' : '$2xl'}
    >
      <NotebookPostContentContainer>
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
          getImageViewerId={(src) => getPostImageViewerId(post.id, src)}
          content={
            post.editStatus === 'failed' || post.editStatus === 'pending'
              ? lastEditContent
              : content
          }
        />
      </NotebookPostContentContainer>
    </NotebookPostFrame>
  );
}

const NotebookLineBreak = () => `\n\n`;

export const NotebookContentRenderer = createContentRenderer({
  inlineRenderers: {
    lineBreak: NotebookLineBreak,
  },
});
