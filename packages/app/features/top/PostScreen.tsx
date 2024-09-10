import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import * as urbit from '@tloncorp/shared/dist/urbit';
import { PostScreenView } from '@tloncorp/ui';
import { useChannelNavigation } from '../../hooks/useChannelNavigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useChannelContext } from '../../hooks/useChannelContext';

export default function PostScreen({
  postParam,
  goBack,
  handleGoToUserProfile,
}: {
  postParam: {
    id: string;
    authorId: string;
    channelId: string;
  };
  goBack: () => void;
  handleGoToUserProfile: (userId: string) => void;
}) {
  const {
    currentUserId,
    group,
    channel,
    contacts,
    negotiationStatus,
    getDraft,
    storeDraft,
    clearDraft,
    editingPost,
    setEditingPost,
    editPost,
    calmSettings,
    headerMode,
  } = useChannelContext({
    channelId: postParam.channelId,
    draftKey: postParam.id,
    uploaderKey: `${postParam.channelId}/${postParam.id}`,
  });

  const { navigateToImage } = useChannelNavigation({
    channelId: postParam.channelId,
  });

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
  }, []);

  const { data: post } = store.usePostWithThreadUnreads({
    id: postParam.id,
  });
  const { data: threadPosts } = store.useThreadPosts({
    postId: postParam.id,
    authorId: postParam.authorId,
    channelId: postParam.channelId,
  });

  const posts = useMemo(() => {
    return post ? [...(threadPosts ?? []), post] : null;
  }, [post, threadPosts]);

  const markRead = useCallback(() => {
    if (channel && post && threadPosts) {
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

  return currentUserId && channel && post ? (
    <PostScreenView
      handleGoToUserProfile={handleGoToUserProfile}
      canUpload={canUpload}
      contacts={contacts ?? null}
      calmSettings={calmSettings}
      currentUserId={currentUserId}
      parentPost={post}
      posts={posts}
      channel={channel}
      initialThreadUnread={initialThreadUnread}
      goBack={goBack}
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
