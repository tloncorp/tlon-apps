import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import * as urbit from '@tloncorp/shared/urbit';
import { Carousel, ForwardingProps } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDebounceValue } from 'tamagui';

import { useChannelNavigation } from '../../hooks/useChannelNavigation';
import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import { useGroupActions } from '../../hooks/useGroupActions';
import { useFeatureFlag } from '../../lib/featureFlags';
import type { RootStackParamList } from '../../navigation/types';
import { useNavigation } from '../../navigation/utils';
import { useRootNavigation } from '../../navigation/utils';
import {
  AttachmentProvider,
  ChannelHeader,
  ChatOptionsProvider,
  PostScreenView,
  YStack,
  useCurrentUserId,
} from '../../ui';
import { useStore } from '../../ui/contexts/storeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Post'>;

export default function PostScreen(props: Props) {
  const { postId, channelId, authorId } = props.route.params;
  const chatOptionsNavProps = useChatSettingsNavigation();
  const canUpload = store.useCanUpload();
  const { data: post } = store.usePostWithThreadUnreads({
    id: postId,
  });
  const { data: channel } = store.useChannel({ id: channelId });
  const mode: 'single' | 'carousel' =
    channel?.type === 'gallery' ? 'carousel' : 'single';

  return (
    <ChatOptionsProvider
      initialChat={{ type: 'channel', id: channelId }}
      {...chatOptionsNavProps}
    >
      <AttachmentProvider canUpload={canUpload} uploadAsset={store.uploadAsset}>
        {mode === 'carousel' ? (
          <CarouselPostScreenContent channelId={channelId} postId={postId} />
        ) : (
          post && (
            <PostScreenContent
              post={post}
              channelId={channelId}
              authorId={authorId}
            />
          )
        )}
      </AttachmentProvider>
    </ChatOptionsProvider>
  );
}

function CarouselPostScreenContent({
  channelId,
  postId,
}: {
  channelId: string;
  postId: string;
}) {
  const {
    posts,
    query: { fetchNextPage, fetchPreviousPage },
  } = store.useChannelPosts({
    enabled: true,
    channelId: channelId,
    count: 10,
    mode: 'around',
    cursor: postId,
    firstPageCount: 50,
  });
  const { data: channel } = store.useChannel({ id: channelId });

  const initialPostIndex = useMemo(() => {
    return posts?.findIndex((p) => p.id === postId) ?? -1;
  }, [posts, postId]);

  return (
    <PresentationalCarouselPostScreenContent
      {...{
        posts: posts ?? null,
        channel: channel ?? null,
        initialPostIndex,
        fetchNewerPage: fetchNextPage,
        fetchOlderPage: fetchPreviousPage,
        flex: 1,
        width: '100%',
      }}
    />
  );
}

export function PresentationalCarouselPostScreenContent({
  posts,
  channel,
  initialPostIndex,
  fetchNewerPage,
  fetchOlderPage,
  ...passedProps
}: ForwardingProps<
  typeof YStack,
  {
    posts: db.Post[] | null;
    channel: db.Channel | null;
    initialPostIndex: number;
    fetchNewerPage: () => void;
    fetchOlderPage: () => void;
  }
>) {
  const navigation = useNavigation();

  const [visibleIndex, setVisibleIndex] = useState<number | null>(null);

  /*
   * Without this `useDebounceValue`, the header will flicker when adding
   * older posts. With `maintainVisibleContentPosition`, adding new posts to the
   * beginning of the scroll yields a frame where the visible index is
   * incorrect (i.e. a frame between updating content height/offset and
   * receiving the corresponding `onScroll`).
   */
  const headerPost = useDebounceValue(
    posts?.[visibleIndex ?? initialPostIndex],
    10 // found through experimentation
  );

  return channel && posts?.length && initialPostIndex !== -1 ? (
    <YStack {...passedProps}>
      <ChannelHeader
        channel={channel}
        group={channel.group}
        title={
          headerPost == null ? '' : headerPost.title ?? headerPost.authorId
        }
        goBack={() => navigation.goBack()}
        showSearchButton={false}
        post={headerPost}
      />
      <Carousel
        flex={1}
        onVisibleIndexChange={setVisibleIndex}
        initialVisibleIndex={initialPostIndex}
        scrollDirection="horizontal"
        hideOverlayOnTap={false}
        flatListProps={{
          onEndReached: fetchNewerPage,
          onStartReached: fetchOlderPage,
          maintainVisibleContentPosition: { minIndexForVisible: 0 },
        }}
      >
        {posts.map((post) => (
          <Carousel.Item key={post.id} flex={1}>
            <PostScreenContent
              post={post}
              authorId={post.authorId}
              channelId={post.channelId}
              headerHidden
            />
          </Carousel.Item>
        ))}
      </Carousel>
    </YStack>
  ) : null;
}

function PostScreenContent({
  post,
  authorId,
  channelId,
  headerHidden,
}: {
  post: db.Post;
  authorId: string;
  channelId: string;
  headerHidden?: boolean;
}) {
  const postId = post.id;
  const navigation = useNavigation();
  const [isChannelSwitcherEnabled] = useFeatureFlag('channelSwitcher');
  const {
    group,
    channel,
    negotiationStatus,
    getDraft,
    storeDraft,
    clearDraft,
    editingPost,
    setEditingPost,
    editPost,
    headerMode,
  } = useStore().useChannelContext({
    channelId: channelId,
    draftKey: postId,
    isChannelSwitcherEnabled,
  });

  const { navigateToImage, navigateToRef } = useChannelNavigation({
    channelId: channelId,
  });

  const currentUserId = useCurrentUserId();

  // for the unread thread divider, we care about the unread state when you enter but don't want it to update over
  // time
  const [initialThreadUnread, setInitialThreadUnread] =
    useState<db.ThreadUnreadState | null>(null);
  useEffect(() => {
    async function initializeChannelUnread() {
      const unread = await db.getThreadUnreadState({ parentId: postId });
      setInitialThreadUnread(unread ?? null);
    }
    initializeChannelUnread();
  }, [postId]);

  const { data: threadPosts, isLoading: isLoadingPosts } = store.useThreadPosts(
    {
      postId: postId,
      authorId,
      channelId: channelId,
    }
  );

  const posts = useMemo(() => {
    return post ? [...(threadPosts ?? []), post] : null;
  }, [post, threadPosts]);

  const markRead = useCallback(() => {
    if (channel && post && threadPosts && threadPosts.length > 0) {
      store.markThreadRead({
        channel,
        parentPost: post,
        post: threadPosts[0],
      });
    }
  }, [channel, post, threadPosts]);

  const sendReply = useCallback(
    async (content: urbit.Story) => {
      store.sendReply({
        authorId: currentUserId!,
        content,
        channel: channel!,
        parentId: post!.id,
        parentAuthor: post!.authorId,
      });
    },
    [channel, currentUserId, post]
  );

  const handleDeletePost = useCallback(
    async (post: db.Post) => {
      if (!channel) {
        throw new Error('Tried to delete message before channel loaded');
      }
      await store.deleteFailedPost({
        post,
      });
    },
    [channel]
  );

  const handleRetrySend = useCallback(
    async (post: db.Post) => {
      if (!channel) {
        throw new Error('Tried to retry send before channel loaded');
      }
      await store.retrySendPost({
        channel,
        post,
      });
    },
    [channel]
  );

  const handleGoToUserProfile = useCallback(
    (userId: string) => {
      navigation.navigate('UserProfile', { userId });
    },
    [navigation]
  );

  const { performGroupAction } = useGroupActions();

  const handleGoToDm = useCallback(
    async (participants: string[]) => {
      const dmChannel = await store.upsertDmChannel({
        participants,
      });
      navigation.navigate('DM', { channelId: dmChannel.id });
    },
    [navigation]
  );

  const { navigateBackFromPost } = useRootNavigation();
  const handleGoBack = useCallback(() => {
    if (!channel) {
      navigation.goBack();
      return;
    }
    // This allows us to navigate to the channel and highlight the message in the scroller
    // OR navigate back to Activity if we came from there
    navigateBackFromPost(channel!, postId);
  }, [channel, postId, navigation, navigateBackFromPost]);

  return currentUserId && channel && post ? (
    <PostScreenView
      handleGoToUserProfile={handleGoToUserProfile}
      parentPost={post}
      posts={posts}
      isLoadingPosts={isLoadingPosts}
      channel={channel}
      initialThreadUnread={initialThreadUnread}
      goBack={handleGoBack}
      sendReply={sendReply}
      groupMembers={group?.members ?? []}
      handleGoToImage={navigateToImage}
      getDraft={getDraft}
      storeDraft={storeDraft}
      clearDraft={clearDraft}
      markRead={markRead}
      editingPost={editingPost}
      onPressDelete={handleDeletePost}
      onPressRetry={handleRetrySend}
      onPressRef={navigateToRef}
      onGroupAction={performGroupAction}
      goToDm={handleGoToDm}
      setEditingPost={setEditingPost}
      editPost={editPost}
      negotiationMatch={negotiationStatus.matchedOrPending}
      headerMode={headerMode}
      headerHidden={headerHidden}
    />
  ) : null;
}
