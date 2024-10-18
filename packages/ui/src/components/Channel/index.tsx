import { layoutForType, layoutTypeFromChannel } from '@tloncorp/shared';
import {
  isChatChannel as getIsChatChannel,
  useChannel as useChannelFromStore,
  useGroupPreview,
  usePostReference as usePostReferenceHook,
  usePostWithRelations,
} from '@tloncorp/shared/dist';
import * as db from '@tloncorp/shared/dist/db';
import { JSONContent, Story } from '@tloncorp/shared/dist/urbit';
import { ImagePickerAsset } from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatePresence, SizableText, View, YStack } from 'tamagui';

import {
  ChannelProvider,
  GroupsProvider,
  NavigationProvider,
  useCurrentUserId,
} from '../../contexts';
import { Attachment, AttachmentProvider } from '../../contexts/attachment';
import { RequestsProvider } from '../../contexts/requests';
import { ScrollContextProvider } from '../../contexts/scroll';
import * as utils from '../../utils';
import { ChatMessage } from '../ChatMessage';
import { GalleryPost } from '../GalleryPost';
import { GroupPreviewAction, GroupPreviewSheet } from '../GroupPreviewSheet';
import { NotebookPost } from '../NotebookPost';
import {
  ChatInput,
  DraftInputContext,
  GalleryInput,
  NotebookInput,
} from '../draftInputs';
import { DraftInputHandle, GalleryDraftType } from '../draftInputs/shared';
import { ChannelFooter } from './ChannelFooter';
import { ChannelHeader, ChannelHeaderItemsProvider } from './ChannelHeader';
import { DmInviteOptions } from './DmInviteOptions';
import { EmptyChannelNotice } from './EmptyChannelNotice';
import Scroller, { ScrollAnchor } from './Scroller';

export { INITIAL_POSTS_PER_PAGE } from './Scroller';

//TODO implement usePost and useChannel
const useApp = () => {};

export function Channel({
  channel,
  initialChannelUnread,
  posts,
  selectedPostId,
  group,
  headerMode,
  goBack,
  goToChannels,
  goToSearch,
  goToImageViewer,
  goToPost,
  goToDm,
  goToUserProfile,
  messageSender,
  onScrollEndReached,
  onScrollStartReached,
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
  canUpload,
  uploadAsset,
  negotiationMatch,
  hasNewerPosts,
  hasOlderPosts,
  initialAttachments,
}: {
  channel: db.Channel;
  initialChannelUnread?: db.ChannelUnread | null;
  selectedPostId?: string | null;
  headerMode: 'default' | 'next';
  posts: db.Post[] | null;
  group: db.Group | null;
  goBack: () => void;
  goToChannels: () => void;
  goToPost: (post: db.Post) => void;
  goToDm: (participants: string[]) => void;
  goToImageViewer: (post: db.Post, imageUri?: string) => void;
  goToSearch: () => void;
  goToUserProfile: (userId: string) => void;
  messageSender: (content: Story, channelId: string) => Promise<void>;
  uploadAsset: (asset: ImagePickerAsset, isWeb?: boolean) => Promise<void>;
  onScrollEndReached?: () => void;
  onScrollStartReached?: () => void;
  isLoadingPosts?: boolean;
  onPressRef: (channel: db.Channel, post: db.Post) => void;
  markRead: () => void;
  usePost: typeof usePostWithRelations;
  useGroup: typeof useGroupPreview;
  usePostReference: typeof usePostReferenceHook;
  onGroupAction: (action: GroupPreviewAction, group: db.Group) => void;
  useChannel: typeof useChannelFromStore;
  storeDraft: (draft: JSONContent, draftType?: GalleryDraftType) => void;
  clearDraft: (draftType?: GalleryDraftType) => void;
  getDraft: (draftType?: GalleryDraftType) => Promise<JSONContent>;
  editingPost?: db.Post;
  setEditingPost?: (post: db.Post | undefined) => void;
  editPost: (post: db.Post, content: Story) => Promise<void>;
  onPressRetry: (post: db.Post) => void;
  onPressDelete: (post: db.Post) => void;
  initialAttachments?: Attachment[];
  negotiationMatch: boolean;
  hasNewerPosts?: boolean;
  hasOlderPosts?: boolean;
  canUpload: boolean;
}) {
  const [activeMessage, setActiveMessage] = useState<db.Post | null>(null);
  const [inputShouldBlur, setInputShouldBlur] = useState(false);
  const [groupPreview, setGroupPreview] = useState<db.Group | null>(null);
  const title = utils.useChannelTitle(channel);
  const groups = useMemo(() => (group ? [group] : null), [group]);
  const currentUserId = useCurrentUserId();
  const canWrite = utils.useCanWrite(channel, currentUserId);

  const collectionLayout = useMemo(
    () => layoutForType(layoutTypeFromChannel(channel)),
    [channel]
  );

  const isChatChannel = channel ? getIsChatChannel(channel) : true;
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
    (action: GroupPreviewAction, group: db.Group) => {
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
    // NB: technical behavior change: previously, we would avoid scroll-to-selected on notebooks.
    // afaict, there's no way to select a post in a notebook, so the UX should be the same.
    // (also, I personally think it's confusing to user to block scroll-to on selection for notebooks)
    if (selectedPostId) {
      return { type: 'selected', postId: selectedPostId };
    }

    if (collectionLayout.enableUnreadAnchor) {
      if (
        initialChannelUnread?.countWithoutThreads &&
        initialChannelUnread.firstUnreadPostId
      ) {
        return {
          type: 'unread',
          postId: initialChannelUnread.firstUnreadPostId,
        };
      }
    }

    return null;
  }, [
    collectionLayout.enableUnreadAnchor,
    selectedPostId,
    initialChannelUnread,
  ]);

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

  /** when `null`, input is not shown or presentation is unknown */
  const [draftInputPresentationMode, setDraftInputPresentationMode] = useState<
    null | 'fullscreen' | 'inline'
  >(null);

  const draftInputRef = useRef<DraftInputHandle>(null);

  const draftInputContext = useMemo(
    (): DraftInputContext => ({
      channel,
      clearDraft,
      draftInputRef,
      editPost,
      editingPost,
      getDraft,
      group,
      onPresentationModeChange: setDraftInputPresentationMode,
      send: messageSender,
      setEditingPost,
      setShouldBlur: setInputShouldBlur,
      shouldBlur: inputShouldBlur,
      storeDraft,
      headerMode: headerMode,
    }),
    [
      channel,
      clearDraft,
      editPost,
      editingPost,
      getDraft,
      group,
      inputShouldBlur,
      messageSender,
      setEditingPost,
      storeDraft,
      headerMode,
    ]
  );

  const handleGoBack = useCallback(() => {
    if (
      draftInputPresentationMode === 'fullscreen' &&
      draftInputRef.current != null
    ) {
      draftInputRef.current.exitFullscreen();
      setEditingPost?.(undefined);
    } else {
      goBack();
    }
  }, [goBack, draftInputPresentationMode, draftInputRef, setEditingPost]);

  return (
    <ScrollContextProvider>
      <GroupsProvider groups={groups}>
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
              onGoToUserProfile={goToUserProfile}
            >
              <AttachmentProvider
                canUpload={canUpload}
                initialAttachments={initialAttachments}
                uploadAsset={uploadAsset}
              >
                <View backgroundColor="$background" flex={1}>
                  <YStack
                    justifyContent="space-between"
                    width="100%"
                    height="100%"
                  >
                    <ChannelHeaderItemsProvider>
                      <>
                        <ChannelHeader
                          channel={channel}
                          group={group}
                          mode={headerMode}
                          title={title ?? ''}
                          goBack={handleGoBack}
                          showSearchButton={isChatChannel}
                          goToSearch={goToSearch}
                          showSpinner={isLoadingPosts}
                          showMenuButton={true}
                        />
                        <YStack alignItems="stretch" flex={1}>
                          <AnimatePresence>
                            {draftInputPresentationMode !== 'fullscreen' && (
                              <View flex={1}>
                                {channel && posts && (
                                  <Scroller
                                    key={scrollerAnchor?.postId}
                                    inverted={
                                      collectionLayout.scrollDirection ===
                                      'bottom-to-top'
                                    }
                                    renderItem={renderItem}
                                    renderEmptyComponent={renderEmptyComponent}
                                    anchor={scrollerAnchor}
                                    posts={posts}
                                    hasNewerPosts={hasNewerPosts}
                                    hasOlderPosts={hasOlderPosts}
                                    editingPost={editingPost}
                                    setEditingPost={setEditingPost}
                                    channel={channel}
                                    firstUnreadId={
                                      initialChannelUnread?.countWithoutThreads ??
                                      0 > 0
                                        ? initialChannelUnread?.firstUnreadPostId
                                        : null
                                    }
                                    unreadCount={
                                      initialChannelUnread?.countWithoutThreads ??
                                      0
                                    }
                                    onPressPost={
                                      isChatChannel ? undefined : goToPost
                                    }
                                    onPressReplies={goToPost}
                                    onPressImage={goToImageViewer}
                                    onEndReached={onScrollEndReached}
                                    onStartReached={onScrollStartReached}
                                    onPressRetry={onPressRetry}
                                    onPressDelete={onPressDelete}
                                    activeMessage={activeMessage}
                                    setActiveMessage={setActiveMessage}
                                    ref={flatListRef}
                                    headerMode={headerMode}
                                  />
                                )}
                              </View>
                            )}
                          </AnimatePresence>

                          {canWrite && (
                            <>
                              {isChatChannel &&
                                !channel.isDmInvite &&
                                (negotiationMatch ? (
                                  <ChatInput
                                    draftInputContext={draftInputContext}
                                  />
                                ) : (
                                  <SafeAreaView
                                    edges={['right', 'left', 'bottom']}
                                  >
                                    <NegotionMismatchNotice />
                                  </SafeAreaView>
                                ))}

                              {channel.type === 'gallery' && (
                                <GalleryInput
                                  draftInputContext={draftInputContext}
                                />
                              )}

                              {channel.type === 'notebook' && (
                                <NotebookInput
                                  draftInputContext={draftInputContext}
                                />
                              )}
                            </>
                          )}

                          {channel.isDmInvite && (
                            <DmInviteOptions
                              channel={channel}
                              goBack={goBack}
                            />
                          )}
                        </YStack>
                        {headerMode === 'next' ? (
                          <ChannelFooter
                            title={title ?? ''}
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
                      </>
                    </ChannelHeaderItemsProvider>
                  </YStack>
                </View>
              </AttachmentProvider>
            </NavigationProvider>
          </RequestsProvider>
        </ChannelProvider>
      </GroupsProvider>
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
