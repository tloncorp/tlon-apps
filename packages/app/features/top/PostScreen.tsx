import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import * as urbit from '@tloncorp/shared/dist/urbit';
import { PostScreenView, useCurrentUserId } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useChannelContext } from '../../hooks/useChannelContext';
import { useChannelNavigation } from '../../hooks/useChannelNavigation';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Post'>;

export default function PostScreen(props: Props) {
  const postParam = props.route.params.post;
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
    channelId: postParam.channelId,
    draftKey: postParam.id,
    uploaderKey: `${postParam.channelId}/${postParam.id}`,
  });

  const { navigateToImage } = useChannelNavigation({
    channelId: postParam.channelId,
  });

  const currentUserId = useCurrentUserId();

  // for the unread thread divider, we care about the unread state when you enter but don't want it to update over
  // time
  const [initialThreadUnread, setInitialThreadUnread] =
    useState<db.ThreadUnreadState | null>(null);
  useEffect(() => {
    async function initializeChannelUnread() {
      const unread = await db.getThreadUnreadState({ parentId: postParam.id });
      setInitialThreadUnread(unread ?? null);
    }
    initializeChannelUnread();
  }, [postParam.id]);

  const { data: post } = store.usePostWithThreadUnreads({
    id: postParam.id,
  });
  const { data: threadPosts, isLoading: isLoadingPosts } = store.useThreadPosts(
    {
      postId: postParam.id,
      authorId: postParam.authorId,
      channelId: postParam.channelId,
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
  const canUpload = store.useCanUpload();

  const handleGoToUserProfile = useCallback(
    (userId: string) => {
      props.navigation.push('UserProfile', { userId });
    },
    [props.navigation]
  );

  return currentUserId && channel && post ? (
    <PostScreenView
      handleGoToUserProfile={handleGoToUserProfile}
      canUpload={canUpload}
      parentPost={post}
      posts={posts}
      isLoadingPosts={isLoadingPosts}
      channel={channel}
      initialThreadUnread={initialThreadUnread}
      goBack={props.navigation.goBack}
      sendReply={sendReply}
      groupMembers={group?.members ?? []}
      uploadAsset={store.uploadAsset}
      handleGoToImage={navigateToImage}
      getDraft={getDraft}
      storeDraft={storeDraft}
      clearDraft={clearDraft}
      markRead={markRead}
      editingPost={editingPost}
      onPressDelete={handleDeletePost}
      onPressRetry={handleRetrySend}
      setEditingPost={setEditingPost}
      editPost={editPost}
      negotiationMatch={negotiationStatus.matchedOrPending}
      headerMode={headerMode}
    />
  ) : null;
}
