import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AnalyticsEvent,
  configurationFromChannel,
  trackEvent,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { Button, LoadingSpinner, Text } from '@tloncorp/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'tamagui';

import {
  useLifecyclePermit,
  type LifecyclePermit,
} from '../../hooks/useLifecyclePermit';
import { useChannelNavigation } from '../../hooks/useChannelNavigation';
import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import { useGroupActions } from '../../hooks/useGroupActions';
import type { RootStackParamList } from '../../navigation/types';
import { useNavigation, useRootNavigation } from '../../navigation/utils';
import {
  AttachmentProvider,
  ChatOptionsProvider,
  PostScreenView,
  ScreenHeader,
  useCurrentUserId,
} from '../../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Post'>;

export default function PostScreen(props: Props) {
  const { postId, channelId, authorId, selectedPostId, groupId } =
    props.route.params;
  const chatOptionsNavProps = useChatSettingsNavigation();
  const canUpload = store.useCanUpload();
  const {
    data: post,
    isFetched,
    refetch,
  } = store.usePostWithThreadUnreads({
    id: postId,
  });

  const { resetToChannel } = useRootNavigation();
  const focused = useIsFocused();
  const visit = useLifecyclePermit(
    [props.route.key, postId, channelId, authorId, groupId],
    focused
  );
  const [retry, setRetry] = useState(0);
  const [attempt, setAttempt] = useState<{
    owner: LifecyclePermit;
    phase: 'loading' | 'error' | 'unavailable';
  } | null>(null);
  const pendingRequest = useRef<object | null>(null);
  const hasPost = post != null;

  useEffect(() => {
    // An initial error settles acquisition too. A fresh undefined-data read
    // can become pending again without retiring its own request. Only an
    // actual parent arrival changes presence; undefined→null remains absent.
    if (hasPost || !isFetched || !visit.isCurrent()) return;
    const validVisit = visit.capture();
    const request = {};
    let active = true;
    pendingRequest.current = request;
    setAttempt({ owner: visit, phase: 'loading' });
    const current = () =>
      active && validVisit() && pendingRequest.current === request;
    void (async () => {
      try {
        // Sync writes shared DB state; only this committed route may publish
        // its completion. A background result remains useful to the shared DB.
        await store.syncThreadPosts({ postId, authorId, channelId });
        if (!current()) return;
        // Do not infer absence from the stale render preceding invalidation.
        // This is an explicit settled local read after the successful DB write.
        const refreshed = await refetch({ throwOnError: true });
        if (!current()) return;
        pendingRequest.current = null;
        if (refreshed.isError) setAttempt({ owner: visit, phase: 'error' });
        else if (!refreshed.data)
          setAttempt({ owner: visit, phase: 'unavailable' });
      } catch {
        if (!current()) return;
        pendingRequest.current = null;
        setAttempt({ owner: visit, phase: 'error' });
      }
    })();
    return () => {
      active = false;
      if (pendingRequest.current === request) pendingRequest.current = null;
    };
  }, [hasPost, isFetched, postId, authorId, channelId, refetch, retry, visit]);

  const handleLoadingBack = useCallback(() => {
    if (!visit.isCurrent()) return;
    // A direct-open thread may have no prior route. Consult live navigation
    // state at the press, without requiring the parent/channel query to finish.
    if (props.navigation.canGoBack()) props.navigation.goBack();
    else resetToChannel(channelId, { groupId: groupId ?? undefined });
  }, [visit, props.navigation, resetToChannel, channelId, groupId]);
  const handleLoadRetry = useCallback(() => {
    if (!visit.isCurrent() || pendingRequest.current) return;
    setAttempt({ owner: visit, phase: 'loading' });
    setRetry((value) => value + 1);
  }, [visit]);
  const pendingPhase = attempt?.owner === visit ? attempt.phase : 'loading';

  return (
    <ChatOptionsProvider
      initialChat={{ type: 'channel', id: channelId }}
      {...chatOptionsNavProps}
    >
      <AttachmentProvider canUpload={canUpload} uploadAsset={store.uploadAsset}>
        {post ? (
          <PostScreenContent
            post={post}
            channelId={channelId}
            authorId={authorId}
            selectedPostId={selectedPostId}
            onLoadingBack={handleLoadingBack}
          />
        ) : (
          <PostLoadingShell
            phase={pendingPhase}
            onBack={handleLoadingBack}
            onRetry={handleLoadRetry}
          />
        )}
      </AttachmentProvider>
    </ChatOptionsProvider>
  );
}

function PostLoadingShell({
  phase = 'loading',
  onBack,
  onRetry,
}: {
  phase?: 'loading' | 'error' | 'unavailable';
  onBack: () => void;
  onRetry?: () => void;
}) {
  return (
    <View
      flex={1}
      backgroundColor="$background"
      testID="PostScreenLoadingShell"
    >
      <ScreenHeader title="Thread" backAction={onBack} placement="navigation" />
      <View
        flex={1}
        alignItems="center"
        justifyContent="center"
        gap="$l"
        padding="$l"
      >
        {phase === 'loading' ? (
          <>
            <LoadingSpinner />
            <Text color="$secondaryText">Loading thread…</Text>
          </>
        ) : (
          <>
            <Text color="$secondaryText">
              {phase === 'error'
                ? 'Could not load this thread.'
                : 'This thread is not available yet.'}
            </Text>
            <Button
              preset="secondary"
              label="Try again"
              centered
              onPress={onRetry}
            />
          </>
        )}
      </View>
    </View>
  );
}

function PostScreenContent({
  post,
  channelId,
  selectedPostId,
  onLoadingBack,
}: {
  post: db.Post;
  authorId: string;
  channelId: string;
  selectedPostId?: string | null;
  onLoadingBack: () => void;
}) {
  const postId = post.id;
  const navigation = useNavigation();
  const { group, channel, negotiationStatus, editingPost, setEditingPost } =
    store.useChannelContext({
      channelId: channelId,
      draftKey: store.draftKeyFor.thread({
        parentPostId: postId,
      }),
    });

  const {
    navigateToImage,
    navigateToContextLensRuns,
    navigateToContextLensRun,
  } = useChannelNavigation({
    channelId: channelId,
  });

  const currentUserId = useCurrentUserId();
  const channelType = channel?.type;
  const { data: showDeleteMarkers = false } = store.useShowDeleteMarkers();
  const shouldHideDeletedPost = Boolean(
    post.isDeleted &&
    channel &&
    configurationFromChannel(channel).includeDeletedPosts &&
    !showDeleteMarkers
  );

  useEffect(() => {
    if (!channelType) return;
    trackEvent(AnalyticsEvent.PostOpened, { type: channelType });
  }, [channelType, postId]);

  useEffect(() => {
    if (shouldHideDeletedPost) {
      navigation.goBack();
    }
  }, [navigation, shouldHideDeletedPost]);

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

  // Channel acquisition can follow the parent read; retain a navigable shell
  // until this required context arrives. The authenticated-user gate is unchanged.
  if (!channel) return <PostLoadingShell onBack={onLoadingBack} />;

  return currentUserId && post && !shouldHideDeletedPost ? (
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
      goToContextLensRuns={navigateToContextLensRuns}
      goToContextLensRun={navigateToContextLensRun}
      negotiationMatch={negotiationStatus.matchedOrPending}
      selectedPostId={selectedPostId}
      // NB: If we're showing posts in a carousel, all carousel items share the
      // same editingPost.
      editingPost={editingPost}
      setEditingPost={setEditingPost}
    />
  ) : null;
}
