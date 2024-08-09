import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useChannelContext } from '@tloncorp/app/hooks/useChannelContext';
import { createDevLogger } from '@tloncorp/shared/dist';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import {
  useCanUpload,
  useChannel,
  useGroupPreview,
  usePostReference,
  usePostWithRelations,
} from '@tloncorp/shared/dist/store';
import { Story } from '@tloncorp/shared/dist/urbit';
import {
  Channel,
  ChannelSwitcherSheet,
  GroupOptionsProvider,
  INITIAL_POSTS_PER_PAGE,
} from '@tloncorp/ui';
import React, { useCallback, useEffect, useMemo } from 'react';

import type { GroupSettingsStackParamList, RootStackParamList } from '../types';

type ChannelScreenProps = NativeStackScreenProps<RootStackParamList, 'Channel'>;

const logger = createDevLogger('ChannelScreen', false);

export default function ChannelScreen(props: ChannelScreenProps) {
  useFocusEffect(
    useCallback(() => {
      if (props.route.params.channel.group?.isNew) {
        store.markGroupVisited(props.route.params.channel.group);
      }

      if (!props.route.params.channel.isPendingChannel) {
        store.syncChannelThreadUnreads(props.route.params.channel.id, {
          priority: store.SyncPriority.High,
        });
      }
    }, [props.route.params.channel])
  );
  useFocusEffect(
    useCallback(
      () =>
        // Mark the channel as visited when we unfocus/leave this screen
        () => {
          store.markChannelVisited(props.route.params.channel);
        },
      [props.route.params.channel]
    )
  );

  const [channelNavOpen, setChannelNavOpen] = React.useState(false);
  const [currentChannelId, setCurrentChannelId] = React.useState(
    props.route.params.channel.id
  );

  const {
    negotiationStatus,
    getDraft,
    storeDraft,
    clearDraft,
    editingPost,
    setEditingPost,
    editPost,
    contacts,
    channel,
    group,
    navigateToImage,
    navigateToPost,
    navigateToRef,
    navigateToSearch,
    calmSettings,
    currentUserId,
    performGroupAction,
    headerMode,
  } = useChannelContext({
    channelId: currentChannelId,
    draftKey: currentChannelId,
    uploaderKey: `${currentChannelId}`,
  });

  const session = store.useCurrentSession();
  const hasCachedNewest = useMemo(() => {
    if (!session || !channel) {
      return false;
    }
    const { syncedAt, lastPostAt } = channel;
    if (syncedAt && session.startTime < syncedAt) {
      return true;
    } else if (lastPostAt && syncedAt && syncedAt > lastPostAt) {
      return true;
    }
    return false;
  }, [channel, session]);

  const selectedPostId = props.route.params.selectedPostId;
  const cursor = useMemo(() => {
    if (!channel) {
      return undefined;
    }
    const unread = channel?.unread;
    const firstUnreadId =
      unread &&
      (unread.countWithoutThreads ?? 0) > 0 &&
      unread?.firstUnreadPostId;
    return selectedPostId || firstUnreadId;
    // We only want this to rerun when the channel is loaded for the first time OR if
    // the selected post route param changes
    // eslint-disable-next-line
  }, [!!channel, selectedPostId]);

  useEffect(() => {
    if (channel?.id) {
      logger.sensitiveCrumb(`channelId: ${channel?.id}`, `cursor: ${cursor}`);
    }
  }, [channel?.id, cursor]);

  const {
    posts,
    query: postsQuery,
    loadNewer,
    loadOlder,
    isLoading: isLoadingPosts,
  } = store.useChannelPosts({
    enabled: !!channel && !channel?.isPendingChannel,
    channelId: currentChannelId,
    count: 50,
    hasCachedNewest,
    ...(cursor
      ? {
          mode: 'around',
          cursor,
          firstPageCount: INITIAL_POSTS_PER_PAGE,
        }
      : {
          mode: 'newest',
          firstPageCount: 50,
        }),
  });

  const sendPost = useCallback(
    async (content: Story, _channelId: string, metadata?: db.PostMetadata) => {
      if (!channel) {
        throw new Error('Tried to send message before channel loaded');
      }

      await store.sendPost({
        channel: channel,
        authorId: currentUserId,
        content,
        metadata,
      });
    },
    [currentUserId, channel]
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

  const handleChannelNavButtonPressed = useCallback(() => {
    setChannelNavOpen(true);
  }, []);

  const handleChannelSelected = useCallback((channel: db.Channel) => {
    setCurrentChannelId(channel.id);
    setChannelNavOpen(false);
  }, []);

  const handleGoToDm = useCallback(
    async (participants: string[]) => {
      const dmChannel = await store.upsertDmChannel({
        participants,
      });
      props.navigation.push('Channel', { channel: dmChannel });
    },
    [props.navigation]
  );

  const handleMarkRead = useCallback(() => {
    if (channel && !channel.isPendingChannel) {
      store.markChannelRead(channel);
    }
  }, [channel]);

  const canUpload = useCanUpload();

  const groupParam = props.route.params.channel.group;
  const isFocused = useIsFocused();

  const { data: chats } = store.useCurrentChats({
    enabled: isFocused,
  });

  const pinnedItems = useMemo(() => {
    return chats?.pinned ?? [];
  }, [chats]);

  const navigateToGroupSettings = useCallback(
    <T extends keyof GroupSettingsStackParamList>(
      screen: T,
      params: GroupSettingsStackParamList[T]
    ) => {
      props.navigation.navigate('GroupSettings', {
        screen,
        params,
      } as any);
    },
    [props.navigation]
  );

  const handleGoToGroupMeta = useCallback(
    (groupId: string) => {
      navigateToGroupSettings('GroupMeta', { groupId });
    },
    [navigateToGroupSettings]
  );

  const handleGoToGroupMembers = useCallback(
    (groupId: string) => {
      navigateToGroupSettings('GroupMembers', { groupId });
    },
    [navigateToGroupSettings]
  );

  const handleGoToManageChannels = useCallback(
    (groupId: string) => {
      navigateToGroupSettings('ManageChannels', { groupId });
    },
    [navigateToGroupSettings]
  );

  const handleGoToInvitesAndPrivacy = useCallback(
    (groupId: string) => {
      navigateToGroupSettings('InvitesAndPrivacy', { groupId });
    },
    [navigateToGroupSettings]
  );

  const handleGoToRoles = useCallback(
    (groupId: string) => {
      navigateToGroupSettings('GroupRoles', { groupId });
    },
    [navigateToGroupSettings]
  );

  const handleGoToUserProfile = useCallback(
    (userId: string) => {
      props.navigation.push('UserProfile', { userId });
    },
    [props.navigation]
  );

  if (!channel) {
    return null;
  }

  return (
    <GroupOptionsProvider
      groupId={groupParam?.id}
      pinned={pinnedItems}
      useGroup={store.useGroup}
      onPressGroupMeta={handleGoToGroupMeta}
      onPressGroupMembers={handleGoToGroupMembers}
      onPressManageChannels={handleGoToManageChannels}
      onPressInvitesAndPrivacy={handleGoToInvitesAndPrivacy}
      onPressRoles={handleGoToRoles}
    >
      <Channel
        headerMode={headerMode}
        channel={channel}
        currentUserId={currentUserId}
        calmSettings={calmSettings}
        isLoadingPosts={isLoadingPosts}
        hasNewerPosts={postsQuery.hasPreviousPage}
        hasOlderPosts={postsQuery.hasNextPage}
        group={group}
        contacts={contacts}
        posts={posts}
        selectedPostId={selectedPostId}
        goBack={props.navigation.goBack}
        messageSender={sendPost}
        goToPost={navigateToPost}
        goToImageViewer={navigateToImage}
        goToChannels={handleChannelNavButtonPressed}
        goToSearch={navigateToSearch}
        goToDm={handleGoToDm}
        goToUserProfile={handleGoToUserProfile}
        uploadAsset={store.uploadAsset}
        onScrollEndReached={loadOlder}
        onScrollStartReached={loadNewer}
        onPressRef={navigateToRef}
        markRead={handleMarkRead}
        usePost={usePostWithRelations}
        usePostReference={usePostReference}
        useGroup={useGroupPreview}
        onGroupAction={performGroupAction}
        useChannel={useChannel}
        storeDraft={storeDraft}
        clearDraft={clearDraft}
        getDraft={getDraft}
        editingPost={editingPost}
        onPressDelete={handleDeletePost}
        onPressRetry={handleRetrySend}
        setEditingPost={setEditingPost}
        editPost={editPost}
        negotiationMatch={negotiationStatus.matchedOrPending}
        canUpload={canUpload}
      />
      {group && (
        <ChannelSwitcherSheet
          open={channelNavOpen}
          onOpenChange={(open) => setChannelNavOpen(open)}
          group={group}
          channels={group?.channels || []}
          contacts={contacts ?? []}
          onSelect={handleChannelSelected}
        />
      )}
    </GroupOptionsProvider>
  );
}
