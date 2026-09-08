import * as db from '@tloncorp/shared/db';
import { Text } from '@tloncorp/ui';
import { ReactNode, useMemo } from 'react';
import { View, YStack, getTokenValue } from 'tamagui';

import type { ConversationContentInsets } from './conversationInsets';
import type { PostListMethods } from './Channel/PostList/shared';
import Scroller, { ScrollAnchor } from './Channel/Scroller';
import { ThinkingState } from './Channel/ThinkingState';
import { useShouldShowThinkingState } from './Channel/useShouldShowThinkingState';
import { ChatMessage } from './ChatMessage';
import { GalleryPostDetailView } from './GalleryPost/GalleryPost';
import { NotebookPostDetailView } from './NotebookPost/NotebookPost';

export interface DetailViewProps {
  /** Route focus combined with the active carousel item, when applicable. */
  isFocused?: boolean;
  post: db.Post;
  channel: db.Channel;
  initialPostUnread?: db.ThreadUnreadState | null;
  children?: ReactNode;
  editingPost?: db.Post;
  setEditingPost?: (post: db.Post | undefined) => void;
  posts?: db.Post[];
  onPressImage?: (post: db.Post, imageUri?: string) => void;
  goBack?: () => void;
  onPressRetry?: (post: db.Post) => Promise<void>;
  onPressDelete: (post: db.Post) => void;
  inspectContextLensPost?: (post: db.Post) => void;
  onOpenContextLens?: (post: db.Post) => void;
  onGoToBotRun?: (params: { botShip: string; lensId: string }) => void;
  setActiveMessage: (post: db.Post | null) => void;
  activeMessage: db.Post | null;
  anchor?: ScrollAnchor | null;
  highlightPostId?: string | null;
  scrollerRef?: React.RefObject<PostListMethods | null>;
  contentInsets?: ConversationContentInsets;
  isLoading?: boolean;
}

export const DetailView = ({
  isFocused,
  post,
  channel,
  initialPostUnread,
  editingPost,
  setEditingPost,
  posts,
  onPressImage,
  onPressRetry,
  onPressDelete,
  inspectContextLensPost,
  onOpenContextLens,
  onGoToBotRun,
  setActiveMessage,
  activeMessage,
  anchor,
  highlightPostId,
  scrollerRef,
  contentInsets,
  isLoading,
}: DetailViewProps) => {
  const channelType = channel.type;
  const isChat = channelType !== 'notebook' && channelType !== 'gallery';
  const resolvedPosts = useMemo(() => {
    if (isChat) {
      return posts ? [post, ...[...posts].reverse()] : posts;
    }
    return posts ? [...posts].reverse() : posts;
  }, [posts, post, isChat]);

  const containingProperties: any = useMemo(() => {
    return isChat
      ? {}
      : {
          width: '100%',
          marginHorizontal: 'auto',
          maxWidth: 600,
        };
  }, [isChat]);

  const threadScopeKey = JSON.stringify([channel.id, post.id]);
  const shouldShowThinkingState = useShouldShowThinkingState(channel);
  const latestPost = resolvedPosts?.[resolvedPosts.length - 1];
  // Computing presence is channel-scoped, so this shows bots thinking
  // anywhere in the channel, not just in this thread. The ideal end state is
  // thread-scoped presence contexts (e.g. /channel/chat/~host/name/thread/<id>)
  // published by the gateway, with the channel view aggregating by prefix.
  const listBottomComponent = useMemo(
    () =>
      shouldShowThinkingState ? (
        <ThinkingState
          scopeKey={threadScopeKey}
          conversationId={channel.id}
          channelType={channel.type}
          latestPostId={latestPost?.id}
          latestPostAuthorId={latestPost?.authorId}
        />
      ) : undefined,
    [
      shouldShowThinkingState,
      threadScopeKey,
      channel.id,
      channel.type,
      latestPost?.authorId,
      latestPost?.id,
    ]
  );

  const listHeaderComponent = useMemo(() => {
    if (isChat) {
      return undefined;
    }
    return (
      <View
        // When replies exist, this header is rendered inside the padded reply
        // list content, so cancel that padding to keep media full width.
        width={posts?.length ? undefined : '100%'}
        marginHorizontal={
          posts?.length ? -getTokenValue('$m', 'space') : 'auto'
        }
        maxWidth={600}
      >
        {channelType === 'gallery' ? (
          <GalleryPostDetailView post={post} onPressImage={onPressImage} />
        ) : channelType === 'notebook' ? (
          <NotebookPostDetailView post={post} onPressImage={onPressImage} />
        ) : null}
      </View>
    );
  }, [isChat, posts?.length, channelType, post, onPressImage]);

  return (
    <View
      paddingHorizontal={isChat ? '$m' : undefined}
      flex={1}
      overflow={isChat ? undefined : 'hidden'}
      {...containingProperties}
    >
      <Scroller
        key={threadScopeKey}
        isFocused={isFocused}
        ref={scrollerRef}
        anchor={anchor}
        anchorToEnd={isChat}
        renderItem={ChatMessage}
        channel={channel}
        collectionLayoutType="compact-list-bottom-to-top"
        editingPost={editingPost}
        setEditingPost={setEditingPost}
        posts={resolvedPosts ?? null}
        showReplies={false}
        showDividers={isChat}
        onPressImage={onPressImage}
        onPressRetry={onPressRetry}
        onPressDelete={onPressDelete}
        onPressPost={inspectContextLensPost}
        onOpenContextLens={onOpenContextLens}
        onGoToBotRun={onGoToBotRun}
        highlightPostId={highlightPostId}
        firstUnreadId={
          (initialPostUnread?.count ?? 0 > 0)
            ? initialPostUnread?.firstUnreadPostId
            : null
        }
        renderEmptyComponent={RepliesEmptyComponent}
        unreadCount={initialPostUnread?.count ?? 0}
        activeMessage={activeMessage}
        setActiveMessage={setActiveMessage}
        listHeaderComponent={listHeaderComponent}
        listBottomComponent={listBottomComponent}
        contentInsets={contentInsets}
        isLoading={isLoading}
      />
    </View>
  );
};

function RepliesEmptyComponent() {
  return (
    <YStack padding="$2xl" alignItems="center">
      <Text size="$body" color="$tertiaryText">
        No replies yet
      </Text>
    </YStack>
  );
}
