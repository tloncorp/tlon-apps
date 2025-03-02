import { isChatChannel as getIsChatChannel } from '@tloncorp/shared';
import type * as db from '@tloncorp/shared/db';
import * as urbit from '@tloncorp/shared/urbit';
import { Story } from '@tloncorp/shared/urbit';
import { KeyboardAvoidingView } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, YStack } from 'tamagui';

import {
  ChannelProvider,
  NavigationProvider,
  useAttachmentContext,
  useCurrentUserId,
} from '../contexts';
import * as utils from '../utils';
import BareChatInput from './BareChatInput';
import { BigInput } from './BigInput';
import { ChannelFooter } from './Channel/ChannelFooter';
import { ChannelHeader } from './Channel/ChannelHeader';
import { DetailView } from './DetailView';
import { FileDrop } from './FileDrop';
import { GroupPreviewAction, GroupPreviewSheet } from './GroupPreviewSheet';

export function PostScreenView({
  channel,
  initialThreadUnread,
  parentPost,
  posts,
  isLoadingPosts,
  sendReply,
  markRead,
  goBack,
  groupMembers,
  handleGoToImage,
  handleGoToUserProfile,
  storeDraft,
  clearDraft,
  getDraft,
  editingPost,
  setEditingPost,
  editPost,
  onPressRetry,
  onPressDelete,
  onPressRef,
  onGroupAction,
  goToDm,
  negotiationMatch,
  headerMode,
  headerHidden,
}: {
  channel: db.Channel;
  initialThreadUnread?: db.ThreadUnreadState | null;
  group?: db.Group | null;
  parentPost: db.Post | null;
  posts: db.Post[] | null;
  isLoadingPosts: boolean;
  sendReply: (content: urbit.Story, channelId: string) => Promise<void>;
  markRead: () => void;
  goBack?: () => void;
  groupMembers: db.ChatMember[];
  handleGoToImage?: (post: db.Post, uri?: string) => void;
  handleGoToUserProfile: (userId: string) => void;
  storeDraft: (draft: urbit.JSONContent) => Promise<void>;
  clearDraft: () => Promise<void>;
  getDraft: () => Promise<urbit.JSONContent | null>;
  editingPost?: db.Post;
  setEditingPost?: (post: db.Post | undefined) => void;
  editPost: (
    post: db.Post,
    content: Story,
    parentId?: string,
    metadata?: db.PostMetadata
  ) => Promise<void>;
  onPressRetry?: (post: db.Post) => Promise<void>;
  onPressDelete: (post: db.Post) => void;
  onPressRef: (channel: db.Channel, post: db.Post) => void;
  onGroupAction: (action: GroupPreviewAction, group: db.Group) => void;
  goToDm: (participants: string[]) => void;
  negotiationMatch: boolean;
  headerHidden?: boolean;
  headerMode: 'default' | 'next';
}) {
  const currentUserId = useCurrentUserId();
  const currentUserIsAdmin = utils.useIsAdmin(
    channel.groupId ?? '',
    currentUserId
  );
  const isChatChannel = channel ? getIsChatChannel(channel) : true;
  const [groupPreview, setGroupPreview] = useState<db.Group | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const showEdit = useMemo(() => {
    return (
      !editingPost &&
      channel.type === 'notebook' &&
      (parentPost?.authorId === currentUserId || currentUserIsAdmin)
    );
  }, [
    editingPost,
    channel.type,
    parentPost?.authorId,
    currentUserId,
    currentUserIsAdmin,
  ]);

  const handleEditPress = useCallback(() => {
    setEditingPost?.(parentPost ?? undefined);
  }, [parentPost, setEditingPost]);

  const { bottom } = useSafeAreaInsets();

  const headerTitle = isChatChannel
    ? `Thread: ${channel?.title ?? null}`
    : parentPost?.title && parentPost.title !== ''
      ? parentPost.title
      : 'Post';

  const hasLoaded = !!(posts && channel && parentPost);
  useEffect(() => {
    if (hasLoaded) {
      markRead();
    }
    // Only want to trigger once per set of params
    // eslint-disable-next-line
  }, [hasLoaded]);

  const isEditingParent = useMemo(() => {
    return editingPost && editingPost.id === parentPost?.id;
  }, [editingPost, parentPost]);

  const onPressGroupRef = useCallback((group: db.Group) => {
    setGroupPreview(group);
  }, []);

  const handleGroupAction = useCallback(
    (action: GroupPreviewAction, group: db.Group) => {
      onGroupAction(action, group);
      setGroupPreview(null);
    },
    [onGroupAction]
  );

  const handleRefPress = useCallback(
    (refChannel: db.Channel, post: db.Post) => {
      const anchorIndex = posts?.findIndex((p) => p.id === post.id) ?? -1;

      if (
        refChannel.id === channel.id &&
        anchorIndex !== -1 &&
        flatListRef.current
      ) {
        // If the post is already loaded, scroll to it
        flatListRef.current?.scrollToIndex({
          index: anchorIndex,
          animated: false,
          viewPosition: 0.5,
        });
        return;
      }

      onPressRef(refChannel, post);
    },
    [onPressRef, posts, channel]
  );

  const handleGoBack = useCallback(() => {
    if (isEditingParent) {
      setEditingPost?.(undefined);
      if (channel.type !== 'notebook') {
        goBack?.();
      } else {
        clearDraft();
      }
    } else {
      goBack?.();
    }
  }, [channel.type, clearDraft, goBack, isEditingParent, setEditingPost]);

  const { attachAssets } = useAttachmentContext();

  return (
    <NavigationProvider
      onGoToUserProfile={handleGoToUserProfile}
      onPressRef={handleRefPress}
      onPressGroupRef={onPressGroupRef}
      onPressGoToDm={goToDm}
    >
      <ChannelProvider value={{ channel }}>
        <FileDrop
          paddingBottom={bottom}
          backgroundColor="$background"
          flex={1}
          onAssetsDropped={attachAssets}
        >
          <YStack flex={1} backgroundColor={'$background'}>
            {headerHidden ? null : (
              <ChannelHeader
                channel={channel}
                group={channel.group}
                title={headerTitle}
                goBack={handleGoBack}
                showSearchButton={false}
                showSpinner={isLoadingPosts}
                post={parentPost ?? undefined}
                mode={headerMode}
                showEditButton={showEdit}
                goToEdit={handleEditPress}
              />
            )}
            <SinglePostView
              {...{
                channel,
                clearDraft,
                editPost,
                editingPost,
                flatListRef,
                getDraft,
                goBack,
                groupMembers,
                handleGoToImage,
                headerMode,
                initialThreadUnread,
                negotiationMatch,
                onPressDelete,
                onPressRetry,
                parentPost,
                posts,
                sendReply,
                setEditingPost,
                storeDraft,
              }}
            />
            <GroupPreviewSheet
              group={groupPreview ?? undefined}
              open={!!groupPreview}
              onOpenChange={() => setGroupPreview(null)}
              onActionComplete={handleGroupAction}
            />
          </YStack>
        </FileDrop>
      </ChannelProvider>
    </NavigationProvider>
  );
}

function SinglePostView({
  channel,
  clearDraft,
  editPost,
  editingPost,
  flatListRef,
  getDraft,
  goBack,
  groupMembers,
  handleGoToImage,
  headerMode,
  initialThreadUnread,
  negotiationMatch,
  onPressDelete,
  onPressRetry,
  parentPost,
  posts,
  sendReply,
  setEditingPost,
  storeDraft,
}: {
  channel: db.Channel;
  clearDraft: () => Promise<void>;
  editPost: (
    post: db.Post,
    content: Story,
    parentId?: string,
    metadata?: db.PostMetadata
  ) => Promise<void>;
  editingPost?: db.Post;
  flatListRef?: React.RefObject<React.ElementRef<typeof FlatList>>;
  getDraft: () => Promise<urbit.JSONContent | null>;
  goBack?: () => void;
  group?: db.Group | null;
  groupMembers: db.ChatMember[];
  handleGoToImage?: (post: db.Post, uri?: string) => void;
  headerMode: 'default' | 'next';
  initialThreadUnread?: db.ThreadUnreadState | null;
  negotiationMatch: boolean;
  onPressDelete: (post: db.Post) => void;
  onPressRetry?: (post: db.Post) => Promise<void>;
  parentPost: db.Post | null;
  posts: db.Post[] | null;
  sendReply: (content: urbit.Story, channelId: string) => Promise<void>;
  setEditingPost?: (post: db.Post | undefined) => void;
  storeDraft: (draft: urbit.JSONContent) => Promise<void>;
}) {
  const currentUserId = useCurrentUserId();
  const [activeMessage, setActiveMessage] = useState<db.Post | null>(null);
  const [inputShouldBlur, setInputShouldBlur] = useState(false);

  const isEditingParent = useMemo(() => {
    return editingPost && editingPost.id === parentPost?.id;
  }, [editingPost, parentPost]);
  const canWrite = utils.useCanWrite(channel, currentUserId);
  const postsWithoutParent = useMemo(
    () => posts?.filter((p) => p.id !== parentPost?.id) ?? [],
    [posts, parentPost]
  );
  const isChatChannel = channel ? getIsChatChannel(channel) : true;

  const containingProperties: any = useMemo(() => {
    return isChatChannel
      ? {}
      : {
          width: '100%',
          marginHorizontal: 'auto',
          maxWidth: 600,
        };
  }, [isChatChannel]);
  const bareInputDraftProps = useMemo(() => {
    // For notebook post, the channel draft corresponds to the note
    // itself (not the reply input)
    if (channel.type === 'notebook') {
      return {
        getDraft: async () => null,
        storeDraft: async () => {},
        clearDraft: async () => {},
      };
    }
    return {
      getDraft,
      storeDraft,
      clearDraft,
    };
  }, [channel.type, getDraft, storeDraft, clearDraft]);

  return (
    <KeyboardAvoidingView enabled={!activeMessage}>
      {parentPost ? (
        <DetailView
          post={parentPost}
          channel={channel}
          initialPostUnread={initialThreadUnread}
          onPressImage={handleGoToImage}
          editingPost={editingPost}
          setEditingPost={setEditingPost}
          onPressRetry={onPressRetry}
          onPressDelete={onPressDelete}
          posts={postsWithoutParent}
          goBack={goBack}
          activeMessage={activeMessage}
          setActiveMessage={setActiveMessage}
          headerMode={headerMode}
          editorIsFocused={false}
          flatListRef={flatListRef}
        />
      ) : null}

      {negotiationMatch &&
        channel &&
        canWrite &&
        !(isEditingParent && channel.type === 'notebook') && (
          <View id="reply-container" {...containingProperties}>
            <BareChatInput
              placeholder="Reply"
              shouldBlur={inputShouldBlur}
              setShouldBlur={setInputShouldBlur}
              send={sendReply}
              channelId={channel.id}
              groupMembers={groupMembers}
              {...bareInputDraftProps}
              editingPost={editingPost}
              setEditingPost={setEditingPost}
              editPost={editPost}
              channelType="chat"
              showAttachmentButton={channel.type === 'chat'}
              showInlineAttachments={channel.type === 'chat'}
              shouldAutoFocus={
                (channel.type === 'chat' && parentPost?.replyCount === 0) ||
                !!editingPost
              }
            />
          </View>
        )}
      {!negotiationMatch && channel && canWrite && (
        <View
          position={isChatChannel ? undefined : 'absolute'}
          bottom={0}
          width="90%"
          alignItems="center"
          justifyContent="center"
          backgroundColor="$secondaryBackground"
          borderRadius="$xl"
          padding="$l"
        >
          <Text>
            Your ship&apos;s version of the Tlon app doesn&apos;t match the
            channel host.
          </Text>
        </View>
      )}

      {parentPost &&
      isEditingParent &&
      (channel.type === 'notebook' || channel.type === 'gallery') ? (
        <BigInput
          channelType={urbit.getChannelType(parentPost.channelId)}
          channelId={parentPost?.channelId}
          editingPost={editingPost}
          setEditingPost={setEditingPost}
          editPost={editPost}
          shouldBlur={inputShouldBlur}
          setShouldBlur={setInputShouldBlur}
          send={async () => {}}
          getDraft={getDraft}
          storeDraft={storeDraft}
          clearDraft={clearDraft}
          groupMembers={groupMembers}
        />
      ) : null}
      {headerMode === 'next' && (
        <ChannelFooter
          showSearchButton={false}
          title={'Thread: ' + channel.title}
          goBack={goBack}
        />
      )}
    </KeyboardAvoidingView>
  );
}
