import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useChannelContext } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import * as urbit from '@tloncorp/shared/urbit';
import { useCallback, useEffect, useMemo, useState } from 'react';
import React from 'react';
import {
  Dimensions,
  FlatList,
  ListRenderItemInfo,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

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
  View,
  useCurrentUserId,
} from '../../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Post'>;

export default function PostScreen(props: Props) {
  const { postId, channelId, authorId } = props.route.params;
  const chatOptionsNavProps = useChatSettingsNavigation();
  const canUpload = store.useCanUpload();
  const mode: 'single' | 'carousel' = 'carousel';
  const { data: post } = store.usePostWithThreadUnreads({
    id: postId,
  });

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
}: {
  posts: db.Post[] | null;
  channel: db.Channel | null;
  initialPostIndex: number;
  fetchNewerPage: () => void;
  fetchOlderPage: () => void;
}) {
  const navigation = useNavigation();

  const [visibleIndex, setVisibleIndex] = useState(initialPostIndex);
  const windowWidth = Dimensions.get('window').width;

  const handleScroll = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(event.nativeEvent.contentOffset.x / windowWidth);
      setVisibleIndex(index);
    },
    [windowWidth]
  );

  const activePost = posts?.[visibleIndex];

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<db.Post>) => {
      return (
        <View width={windowWidth}>
          <PostScreenContent
            post={item}
            authorId={item.authorId}
            channelId={item.channelId}
            headerHidden={true}
          />
        </View>
      );
    },
    [windowWidth]
  );

  const getItemLayout = useCallback(
    (_data: db.Post[], index: number) => ({
      length: windowWidth,
      offset: windowWidth * index,
      index,
    }),
    [windowWidth]
  );

  const contentContainerStyle = useMemo(() => {
    return { alignItems: 'stretch' } as const;
  }, []);

  return channel && posts?.length && initialPostIndex !== -1 ? (
    <View flex={1} width={windowWidth}>
      <ChannelHeader
        channel={channel}
        group={channel?.group}
        title={
          activePost?.title && activePost?.title !== ''
            ? activePost.title
            : 'Untitled Post'
        }
        goBack={() => navigation.goBack()}
        showSearchButton={false}
        post={activePost ?? undefined}
      />
      <FlatList
        keyExtractor={(item) => item.id}
        data={posts}
        decelerationRate="fast"
        initialScrollIndex={initialPostIndex}
        horizontal={true}
        scrollEventThrottle={33}
        onScroll={handleScroll}
        onEndReached={fetchNewerPage}
        onStartReached={fetchOlderPage}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        disableIntervalMomentum={true}
        snapToInterval={windowWidth}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        contentContainerStyle={contentContainerStyle}
        windowSize={3}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        // always maintain content position when new content is loaded in
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      />
    </View>
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
  } = useChannelContext({
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
