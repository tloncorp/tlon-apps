import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useChannelContext } from '@tloncorp/app/hooks/useChannelContext';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import * as urbit from '@tloncorp/shared/dist/urbit';
import { PostScreenView } from '@tloncorp/ui';
import { useCallback, useMemo } from 'react';

import type { RootStackParamList } from '../types';

type PostScreenProps = NativeStackScreenProps<RootStackParamList, 'Post'>;

export default function PostScreen(props: PostScreenProps) {
  const postParam = props.route.params.post;

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
    navigateToImage,
    calmSettings,
    headerMode,
  } = useChannelContext({
    channelId: postParam.channelId,
    draftKey: postParam.id,
    uploaderKey: `${postParam.channelId}/${postParam.id}`,
  });

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
      canUpload={canUpload}
      contacts={contacts ?? null}
      calmSettings={calmSettings}
      currentUserId={currentUserId}
      parentPost={post}
      posts={posts}
      channel={channel}
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
