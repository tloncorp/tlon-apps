import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/dist/store';
import * as urbit from '@tloncorp/shared/dist/urbit';
import { PostScreenView } from '@tloncorp/ui';
import { useCallback, useMemo } from 'react';

import type { RootStackParamList } from '../types';
import { useChannelContext } from './useChannelContext';

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
    uploadInfo,
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
      uploadInfo.resetImageAttachment();
    },
    [channel, currentUserId, post, uploadInfo]
  );

  return currentUserId && channel && post ? (
    <PostScreenView
      contacts={contacts ?? null}
      calmSettings={calmSettings}
      currentUserId={currentUserId}
      parentPost={post}
      posts={posts}
      channel={channel}
      goBack={props.navigation.goBack}
      sendReply={sendReply}
      groupMembers={group?.members ?? []}
      uploadInfo={uploadInfo}
      handleGoToImage={navigateToImage}
      getDraft={getDraft}
      storeDraft={storeDraft}
      clearDraft={clearDraft}
      markRead={markRead}
      editingPost={editingPost}
      setEditingPost={setEditingPost}
      editPost={editPost}
      negotiationMatch={negotiationStatus.matchedOrPending}
      headerMode={headerMode}
    />
  ) : null;
}
