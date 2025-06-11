import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback, useEffect } from 'react';

import { useChannelNavigation } from '../../hooks/useChannelNavigation';
import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import { useGroupActions } from '../../hooks/useGroupActions';
import type { RootStackParamList } from '../../navigation/types';
import { useNavigation, useRootNavigation } from '../../navigation/utils';
import {
  AttachmentProvider,
  ChatOptionsProvider,
  PostScreenView,
  useCurrentUserId,
} from '../../ui';
import { useStore } from '../../ui/contexts/storeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Post'>;

export default function PostScreen(props: Props) {
  const { postId, channelId, authorId } = props.route.params;
  const chatOptionsNavProps = useChatSettingsNavigation();
  const canUpload = store.useCanUpload();
  const { data: post, isLoading } = store.usePostWithThreadUnreads({
    id: postId,
  });

  useEffect(() => {
    // if we don't already have the post in the DB, make sure we sync it
    if (!post && !isLoading) {
      store.syncThreadPosts({ postId, authorId, channelId });
    }
  }, [post, isLoading, postId, authorId, channelId]);

  return (
    <ChatOptionsProvider
      initialChat={{ type: 'channel', id: channelId }}
      {...chatOptionsNavProps}
    >
      <AttachmentProvider canUpload={canUpload} uploadAsset={store.uploadAsset}>
        {post && (
          <PostScreenContent
            post={post}
            channelId={channelId}
            authorId={authorId}
          />
        )}
      </AttachmentProvider>
    </ChatOptionsProvider>
  );
}

function PostScreenContent({
  post,
  channelId,
}: {
  post: db.Post;
  authorId: string;
  channelId: string;
}) {
  const postId = post.id;
  const navigation = useNavigation();
  const {
    group,
    channel,
    negotiationStatus,
    editingPost,
    setEditingPost,
    editPost,
  } = useStore().useChannelContext({
    channelId: channelId,
    draftKey: store.draftKeyFor.thread({
      parentPostId: postId,
    }),
  });

  const { navigateToImage } = useChannelNavigation({
    channelId: channelId,
  });

  const currentUserId = useCurrentUserId();

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
      channel={channel}
      goBack={handleGoBack}
      group={group}
      handleGoToImage={navigateToImage}
      onPressDelete={handleDeletePost}
      onPressRetry={handleRetrySend}
      onGroupAction={performGroupAction}
      goToDm={handleGoToDm}
      negotiationMatch={negotiationStatus.matchedOrPending}
      // NB: If we're showing posts in a carousel, all carousel items share the
      // same editingPost.
      editingPost={editingPost}
      setEditingPost={setEditingPost}
      editPost={editPost}
    />
  ) : null;
}
