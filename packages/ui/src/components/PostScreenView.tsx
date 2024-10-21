import { isChatChannel as getIsChatChannel } from '@tloncorp/shared/dist';
import type * as db from '@tloncorp/shared/dist/db';
import * as urbit from '@tloncorp/shared/dist/urbit';
import { Story } from '@tloncorp/shared/dist/urbit';
import { ImagePickerAsset } from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, YStack } from 'tamagui';

import { NavigationProvider, useCurrentUserId } from '../contexts';
import { AttachmentProvider } from '../contexts/attachment';
import * as utils from '../utils';
import { BigInput } from './BigInput';
import { ChannelFooter } from './Channel/ChannelFooter';
import { ChannelHeader } from './Channel/ChannelHeader';
import { DetailView } from './DetailView';
import { GroupPreviewAction, GroupPreviewSheet } from './GroupPreviewSheet';
import KeyboardAvoidingView from './KeyboardAvoidingView';
import { MessageInput } from './MessageInput';
import { TlonEditorBridge } from './MessageInput/toolbarActions.native';

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
  uploadAsset,
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
  canUpload,
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
  uploadAsset: (asset: ImagePickerAsset) => Promise<void>;
  storeDraft: (draft: urbit.JSONContent) => void;
  clearDraft: () => void;
  getDraft: () => Promise<urbit.JSONContent>;
  editingPost?: db.Post;
  setEditingPost?: (post: db.Post | undefined) => void;
  editPost: (
    post: db.Post,
    content: Story,
    parentId?: string,
    metadata?: db.PostMetadata
  ) => Promise<void>;
  onPressRetry: (post: db.Post) => void;
  onPressDelete: (post: db.Post) => void;
  onPressRef: (channel: db.Channel, post: db.Post) => void;
  onGroupAction: (action: GroupPreviewAction, group: db.Group) => void;
  goToDm: (participants: string[]) => void;
  negotiationMatch: boolean;
  headerMode: 'default' | 'next';
  canUpload: boolean;
}) {
  const [activeMessage, setActiveMessage] = useState<db.Post | null>(null);
  const [inputShouldBlur, setInputShouldBlur] = useState(false);
  const currentUserId = useCurrentUserId();
  const canWrite = utils.useCanWrite(channel, currentUserId);
  const isChatChannel = channel ? getIsChatChannel(channel) : true;
  const postsWithoutParent = useMemo(
    () => posts?.filter((p) => p.id !== parentPost?.id) ?? [],
    [posts, parentPost]
  );
  const editorRef = useRef<{
    editor: TlonEditorBridge | null;
  }>(null);
  const [editorIsFocused, setEditorIsFocused] = useState(false);
  const [groupPreview, setGroupPreview] = useState<db.Group | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // We track the editor focus state to determine when we need to scroll to the
  // bottom of the screen when the keyboard is opened/editor is focused.
  editorRef.current?.editor?._subscribeToEditorStateUpdate((editorState) => {
    setEditorIsFocused(editorState.isFocused);
  });

  const { bottom } = useSafeAreaInsets();

  const headerTitle = isChatChannel
    ? `Thread: ${channel?.title ?? null}`
    : parentPost?.title ?? 'Post';

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
      console.log('setEditingPost', undefined);
      setEditingPost?.(undefined);
    }
    goBack?.();
  }, [goBack, isEditingParent, setEditingPost]);

  return (
    <AttachmentProvider canUpload={canUpload} uploadAsset={uploadAsset}>
      <NavigationProvider
        onGoToUserProfile={handleGoToUserProfile}
        onPressRef={handleRefPress}
        onPressGroupRef={onPressGroupRef}
        onPressGoToDm={goToDm}
      >
        <View paddingBottom={bottom} backgroundColor="$background" flex={1}>
          <YStack flex={1} backgroundColor={'$background'}>
            <ChannelHeader
              channel={channel}
              group={channel.group}
              title={headerTitle}
              goBack={handleGoBack}
              showSearchButton={false}
              showSpinner={isLoadingPosts}
              post={parentPost ?? undefined}
              mode={headerMode}
            />
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
                  editorIsFocused={editorIsFocused}
                  flatListRef={flatListRef}
                />
              ) : null}

              {negotiationMatch && channel && canWrite && (
                <MessageInput
                  placeholder="Reply"
                  shouldBlur={inputShouldBlur}
                  setShouldBlur={setInputShouldBlur}
                  send={sendReply}
                  channelId={channel.id}
                  groupMembers={groupMembers}
                  storeDraft={storeDraft}
                  clearDraft={clearDraft}
                  editingPost={editingPost}
                  setEditingPost={setEditingPost}
                  editPost={editPost}
                  channelType="chat"
                  getDraft={getDraft}
                  // TODO: figure out why autofocus breaks backspace
                  // shouldAutoFocus={
                  // (channel.type === 'chat' && parentPost?.replyCount === 0) ||
                  // !!editingPost
                  // }
                  ref={editorRef}
                />
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
                    Your ship&apos;s version of the Tlon app doesn&apos;t match
                    the channel host.
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
            <GroupPreviewSheet
              group={groupPreview ?? undefined}
              open={!!groupPreview}
              onOpenChange={() => setGroupPreview(null)}
              onActionComplete={handleGroupAction}
            />
          </YStack>
        </View>
      </NavigationProvider>
    </AttachmentProvider>
  );
}
