import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import * as urbit from '@tloncorp/shared/urbit';
import { PostScreenView, useCurrentUserId } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useChannelContext } from '../../hooks/useChannelContext';
import { useChannelNavigation } from '../../hooks/useChannelNavigation';
import { useGroupActions } from '../../hooks/useGroupActions';
import { useFeatureFlag } from '../../lib/featureFlags';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Post'>;

export default function PostScreen(props: Props) {
  const { postId, channelId, authorId } = props.route.params;
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

  const { data: post } = store.usePostWithThreadUnreads({
    id: postId,
  });
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
  const canUpload = store.useCanUpload();

  const handleGoToUserProfile = useCallback(
    (userId: string) => {
      props.navigation.push('UserProfile', { userId });
    },
    [props.navigation]
  );

  const { performGroupAction } = useGroupActions();

  const handleGoToDm = useCallback(
    async (participants: string[]) => {
      const dmChannel = await store.upsertDmChannel({
        participants,
      });
      props.navigation.push('DM', { channelId: dmChannel.id });
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
      onPressRef={navigateToRef}
      onGroupAction={performGroupAction}
      goToDm={handleGoToDm}
      setEditingPost={setEditingPost}
      editPost={editPost}
      negotiationMatch={negotiationStatus.matchedOrPending}
      headerMode={headerMode}
    />
  ) : null;
}
