import {
  isChatChannel as getIsChatChannel,
  useChannel as useChannelFromStore,
  useGroupPreview,
  usePostReference as usePostReferenceHook,
  usePostWithRelations,
} from '@tloncorp/shared/dist';
import { UploadInfo } from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import { JSONContent, Story } from '@tloncorp/shared/dist/urbit';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatePresence } from 'tamagui';

import {
  AppDataContextProvider,
  CalmProvider,
  CalmState,
  ChannelProvider,
  GroupsProvider,
  NavigationProvider,
} from '../../contexts';
import { ReferencesProvider } from '../../contexts/references';
import { RequestsProvider } from '../../contexts/requests';
import { ScrollContextProvider } from '../../contexts/scroll';
import { SizableText, View, YStack } from '../../core';
import { useStickyUnread } from '../../hooks/useStickyUnread';
import * as utils from '../../utils';
import AddGalleryPost from '../AddGalleryPost';
import { BigInput } from '../BigInput';
import { ChatMessage } from '../ChatMessage';
import { FloatingActionButton } from '../FloatingActionButton';
import { GalleryPost } from '../GalleryPost';
import { GroupPreviewSheet } from '../GroupPreviewSheet';
import { Icon } from '../Icon';
import KeyboardAvoidingView from '../KeyboardAvoidingView';
import { MessageInput } from '../MessageInput';
import { NotebookPost } from '../NotebookPost';
import { ChannelFooter } from './ChannelFooter';
import { ChannelHeader } from './ChannelHeader';
import { DmInviteOptions } from './DmInviteOptions';
import { EmptyChannelNotice } from './EmptyChannelNotice';
import Scroller, { ScrollAnchor } from './Scroller';
import UploadedImagePreview from './UploadedImagePreview';

export { INITIAL_POSTS_PER_PAGE } from './Scroller';

//TODO implement usePost and useChannel
const useApp = () => {};

export function Channel({
  channel,
  currentUserId,
  posts,
  selectedPostId,
  contacts,
  group,
  calmSettings,
  headerMode,
  goBack,
  goToChannels,
  goToSearch,
  goToImageViewer,
  goToPost,
  goToDm,
  messageSender,
  onScrollEndReached,
  onScrollStartReached,
  uploadInfo,
  isLoadingPosts,
  markRead,
  onPressRef,
  usePost,
  useGroup,
  usePostReference,
  onGroupAction,
  useChannel,
  storeDraft,
  clearDraft,
  getDraft,
  editingPost,
  setEditingPost,
  editPost,
  onPressRetry,
  onPressDelete,
  negotiationMatch,
  hasNewerPosts,
  hasOlderPosts,
}: {
  channel: db.Channel;
  currentUserId: string;
  selectedPostId?: string | null;
  headerMode?: 'default' | 'next';
  posts: db.Post[] | null;
  contacts: db.Contact[] | null;
  group: db.Group | null;
  calmSettings?: CalmState | null;
  goBack: () => void;
  goToChannels: () => void;
  goToPost: (post: db.Post) => void;
  goToDm: (participants: string[]) => void;
  goToImageViewer: (post: db.Post, imageUri?: string) => void;
  goToSearch: () => void;
  messageSender: (content: Story, channelId: string) => Promise<void>;
  uploadInfo: UploadInfo;
  onScrollEndReached?: () => void;
  onScrollStartReached?: () => void;
  isLoadingPosts?: boolean;
  onPressRef: (channel: db.Channel, post: db.Post) => void;
  markRead: () => void;
  usePost: typeof usePostWithRelations;
  useGroup: typeof useGroupPreview;
  usePostReference: typeof usePostReferenceHook;
  onGroupAction: (action: string, group: db.Group) => void;
  useChannel: typeof useChannelFromStore;
  storeDraft: (draft: JSONContent) => void;
  clearDraft: () => void;
  getDraft: () => Promise<JSONContent>;
  editingPost?: db.Post;
  setEditingPost?: (post: db.Post | undefined) => void;
  editPost: (post: db.Post, content: Story) => Promise<void>;
  onPressRetry: (post: db.Post) => void;
  onPressDelete: (post: db.Post) => void;
  negotiationMatch: boolean;
  hasNewerPosts?: boolean;
  hasOlderPosts?: boolean;
}) {
  const [activeMessage, setActiveMessage] = useState<db.Post | null>(null);
  const [inputShouldBlur, setInputShouldBlur] = useState(false);
  const [showBigInput, setShowBigInput] = useState(false);
  const [showAddGalleryPost, setShowAddGalleryPost] = useState(false);
  const [groupPreview, setGroupPreview] = useState<db.Group | null>(null);
  const title = channel ? utils.getChannelTitle(channel) : '';
  const groups = useMemo(() => (group ? [group] : null), [group]);
  const canWrite = utils.useCanWrite(channel, currentUserId);

  const isChatChannel = channel ? getIsChatChannel(channel) : true;
  const channelUnread = useStickyUnread(channel.unread);
  const renderItem = isChatChannel
    ? ChatMessage
    : channel.type === 'notebook'
      ? NotebookPost
      : GalleryPost;

  const renderEmptyComponent = useCallback(() => {
    return <EmptyChannelNotice channel={channel} userId={currentUserId} />;
  }, [currentUserId, channel]);

  const onPressGroupRef = useCallback((group: db.Group) => {
    setGroupPreview(group);
  }, []);

  const handleGroupAction = useCallback(
    (action: string, group: db.Group) => {
      onGroupAction(action, group);
      setGroupPreview(null);
    },
    [onGroupAction]
  );

  const hasLoaded = !!(posts && channel);
  useEffect(() => {
    if (hasLoaded) {
      markRead();
    }
  }, [hasLoaded, markRead]);

  const scrollerAnchor: ScrollAnchor | null = useMemo(() => {
    if (channel.type === 'notebook') {
      return null;
    } else if (selectedPostId) {
      return { type: 'selected', postId: selectedPostId };
    } else if (
      channel.type !== 'gallery' &&
      channelUnread?.countWithoutThreads &&
      channelUnread.firstUnreadPostId
    ) {
      return { type: 'unread', postId: channelUnread.firstUnreadPostId };
    }
    return null;
  }, [channel.type, selectedPostId, channelUnread]);

  const bigInputGoBack = () => {
    setShowBigInput(false);
    uploadInfo.resetImageAttachment();
  };

  const { bottom } = useSafeAreaInsets();

  const flatListRef = useRef<FlatList<db.Post>>(null);

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

  return (
    <ScrollContextProvider>
      <CalmProvider calmSettings={calmSettings}>
        <GroupsProvider groups={groups}>
          <AppDataContextProvider
            contacts={contacts}
            currentUserId={currentUserId}
          >
            <ChannelProvider value={{ channel }}>
              <RequestsProvider
                usePost={usePost}
                usePostReference={usePostReference}
                useChannel={useChannel}
                useGroup={useGroup}
                useApp={useApp}
                // useBlockUser={() => {}}
              >
                <NavigationProvider
                  onPressRef={handleRefPress}
                  onPressGroupRef={onPressGroupRef}
                  onPressGoToDm={goToDm}
                >
                  <ReferencesProvider>
                    <View
                      paddingBottom={isChatChannel ? bottom : 'unset'}
                      backgroundColor="$background"
                      flex={1}
                    >
                      <YStack
                        justifyContent="space-between"
                        width="100%"
                        height="100%"
                      >
                        <ChannelHeader
                          channel={channel}
                          group={group}
                          mode={headerMode}
                          title={title}
                          goBack={() =>
                            showBigInput ? bigInputGoBack() : goBack()
                          }
                          showSearchButton={isChatChannel}
                          goToSearch={goToSearch}
                          showSpinner={isLoadingPosts}
                          showMenuButton={!isChatChannel}
                        />
                        <KeyboardAvoidingView enabled={!activeMessage}>
                          <YStack alignItems="center" flex={1}>
                            <AnimatePresence>
                              {showBigInput ? (
                                <View
                                  key="big-input"
                                  animation="simple"
                                  enterStyle={{
                                    y: 100,
                                    opacity: 0,
                                  }}
                                  exitStyle={{
                                    y: 100,
                                    opacity: 0,
                                  }}
                                  y={0}
                                  opacity={1}
                                  width="100%"
                                >
                                  <BigInput
                                    channelType={channel.type}
                                    channelId={channel.id}
                                    groupMembers={group?.members ?? []}
                                    shouldBlur={inputShouldBlur}
                                    setShouldBlur={setInputShouldBlur}
                                    send={messageSender}
                                    storeDraft={storeDraft}
                                    clearDraft={clearDraft}
                                    getDraft={getDraft}
                                    editingPost={editingPost}
                                    setEditingPost={setEditingPost}
                                    editPost={editPost}
                                    setShowBigInput={setShowBigInput}
                                    placeholder=""
                                    uploadInfo={uploadInfo}
                                  />
                                </View>
                              ) : uploadInfo.imageAttachment &&
                                channel.type !== 'notebook' ? (
                                <UploadedImagePreview
                                  imageAttachment={uploadInfo.imageAttachment}
                                  uploading={uploadInfo.uploading}
                                  resetImageAttachment={
                                    uploadInfo.resetImageAttachment
                                  }
                                />
                              ) : (
                                <View flex={1} width="100%">
                                  {channel && posts && (
                                    <Scroller
                                      key={scrollerAnchor?.postId}
                                      inverted={isChatChannel ? true : false}
                                      renderItem={renderItem}
                                      renderEmptyComponent={
                                        renderEmptyComponent
                                      }
                                      anchor={scrollerAnchor}
                                      posts={posts}
                                      hasNewerPosts={hasNewerPosts}
                                      hasOlderPosts={hasOlderPosts}
                                      editingPost={editingPost}
                                      setEditingPost={setEditingPost}
                                      editPost={editPost}
                                      channelType={channel.type}
                                      channelId={channel.id}
                                      firstUnreadId={
                                        channelUnread?.countWithoutThreads ??
                                        0 > 0
                                          ? channelUnread?.firstUnreadPostId
                                          : null
                                      }
                                      unreadCount={
                                        channelUnread?.countWithoutThreads ?? 0
                                      }
                                      onPressPost={goToPost}
                                      onPressReplies={goToPost}
                                      onPressImage={goToImageViewer}
                                      onEndReached={onScrollEndReached}
                                      onStartReached={onScrollStartReached}
                                      onPressRetry={onPressRetry}
                                      onPressDelete={onPressDelete}
                                      activeMessage={activeMessage}
                                      setActiveMessage={setActiveMessage}
                                      ref={flatListRef}
                                    />
                                  )}
                                </View>
                              )}
                            </AnimatePresence>
                            {negotiationMatch &&
                              !channel.isDmInvite &&
                              !editingPost &&
                              (isChatChannel ||
                                (channel.type === 'gallery' &&
                                  uploadInfo?.imageAttachment)) &&
                              canWrite && (
                                <MessageInput
                                  shouldBlur={inputShouldBlur}
                                  setShouldBlur={setInputShouldBlur}
                                  send={messageSender}
                                  channelId={channel.id}
                                  uploadInfo={
                                    channel.type === 'notebook'
                                      ? undefined
                                      : uploadInfo
                                  }
                                  groupMembers={group?.members ?? []}
                                  storeDraft={storeDraft}
                                  clearDraft={clearDraft}
                                  getDraft={getDraft}
                                  editingPost={editingPost}
                                  setEditingPost={setEditingPost}
                                  editPost={editPost}
                                  channelType={channel.type}
                                  showAttachmentButton={
                                    channel.type !== 'gallery'
                                  }
                                />
                              )}
                            {!isChatChannel && canWrite && !showBigInput && (
                              <View
                                position="absolute"
                                bottom={bottom}
                                flex={1}
                                width="100%"
                                alignItems="center"
                              >
                                {(channel.type === 'gallery' &&
                                  showAddGalleryPost) ||
                                uploadInfo.imageAttachment ? null : (
                                  <FloatingActionButton
                                    onPress={() =>
                                      channel.type === 'gallery'
                                        ? setShowAddGalleryPost(true)
                                        : setShowBigInput(true)
                                    }
                                    label="New Post"
                                    icon={
                                      <Icon
                                        type="Add"
                                        size={'$s'}
                                        marginRight={'$s'}
                                      />
                                    }
                                  />
                                )}
                              </View>
                            )}
                            {!negotiationMatch && isChatChannel && canWrite && (
                              <NegotionMismatchNotice />
                            )}
                            {channel.isDmInvite && (
                              <DmInviteOptions
                                channel={channel}
                                goBack={goBack}
                              />
                            )}
                            {!negotiationMatch && isChatChannel && canWrite && (
                              <NegotionMismatchNotice />
                            )}
                            {channel.type === 'gallery' && canWrite && (
                              <AddGalleryPost
                                showAddGalleryPost={showAddGalleryPost}
                                setShowAddGalleryPost={setShowAddGalleryPost}
                                setShowGalleryInput={setShowBigInput}
                                setImage={uploadInfo.setAttachments}
                              />
                            )}
                          </YStack>
                        </KeyboardAvoidingView>
                        {headerMode === 'next' ? (
                          <ChannelFooter
                            title={title}
                            goBack={goBack}
                            goToChannels={goToChannels}
                            goToSearch={goToSearch}
                            showPickerButton={!!group}
                          />
                        ) : null}
                        <GroupPreviewSheet
                          group={groupPreview ?? undefined}
                          open={!!groupPreview}
                          onOpenChange={() => setGroupPreview(null)}
                          onActionComplete={handleGroupAction}
                        />
                      </YStack>
                    </View>
                  </ReferencesProvider>
                </NavigationProvider>
              </RequestsProvider>
            </ChannelProvider>
          </AppDataContextProvider>
        </GroupsProvider>
      </CalmProvider>
    </ScrollContextProvider>
  );
}

function NegotionMismatchNotice() {
  return (
    <View alignItems="center" justifyContent="center" padding="$l">
      <View
        backgroundColor="$secondaryBackground"
        borderRadius="$l"
        paddingHorizontal="$l"
        paddingVertical="$xl"
      >
        <SizableText size="$s">
          Your ship&apos;s version of the Tlon app doesn&apos;t match the
          channel host.
        </SizableText>
      </View>
    </View>
  );
}
