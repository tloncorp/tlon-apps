import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import * as urbit from '@tloncorp/shared/urbit';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useChannelNavigation } from '../../hooks/useChannelNavigation';
import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import { useGroupActions } from '../../hooks/useGroupActions';
import { useFeatureFlag } from '../../lib/featureFlags';
import type { RootStackParamList } from '../../navigation/types';
import { useNavigation } from '../../navigation/utils';
import { useRootNavigation } from '../../navigation/utils';
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
  const { data: post } = store.usePostWithThreadUnreads({
    id: postId,
  });

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
  authorId,
  channelId,
}: {
  post: db.Post;
  authorId: string;
  channelId: string;
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

  const { data: threadPosts } = store.useThreadPosts({
    postId: postId,
    authorId,
    channelId: channelId,
  });

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
    />
  ) : null;
}
