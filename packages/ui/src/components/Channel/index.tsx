import {
  DraftInputId,
  layoutForType,
  layoutTypeFromChannel,
} from '@tloncorp/shared';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatePresence, SizableText, View, YStack } from 'tamagui';

import {
  ChannelProvider,
  GroupsProvider,
  NavigationProvider,
  useCurrentUserId,
} from '../../contexts';
import { Attachment, AttachmentProvider } from '../../contexts/attachment';
import { ComponentsKitContextProvider } from '../../contexts/componentsKits';
import { PostCollectionContext } from '../../contexts/postCollection';
import { RequestsProvider } from '../../contexts/requests';
import { ScrollContextProvider } from '../../contexts/scroll';
import * as utils from '../../utils';
import { GroupPreviewAction, GroupPreviewSheet } from '../GroupPreviewSheet';
import { PostCollectionView } from '../PostCollectionView';
import { DraftInputContext } from '../draftInputs';
import { DraftInputHandle, GalleryDraftType } from '../draftInputs/shared';
import {
  ConnectedPostView,
  PostCollectionHandle,
} from '../postCollectionViews/shared';
import { ChannelFooter } from './ChannelFooter';
import { ChannelHeader, ChannelHeaderItemsProvider } from './ChannelHeader';
import { DmInviteOptions } from './DmInviteOptions';
import { DraftInputView } from './DraftInputView';
import { PostView } from './PostView';

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
  const [inputShouldBlur, setInputShouldBlur] = useState(false);
  const [groupPreview, setGroupPreview] = useState<db.Group | null>(null);
  const title = utils.useChannelTitle(channel);
  const groups = useMemo(() => (group ? [group] : null), [group]);
  const currentUserId = useCurrentUserId();
  const canWrite = utils.useCanWrite(channel, currentUserId);
  const collectionRef = useRef<PostCollectionHandle>(null);

  const isChatChannel = channel ? getIsChatChannel(channel) : true;

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

  const handleRefPress = useCallback(
    (refChannel: db.Channel, post: db.Post) => {
      const anchorIndex = posts?.findIndex((p) => p.id === post.id) ?? -1;

      if (
        refChannel.id === channel.id &&
        anchorIndex !== -1 &&
        collectionRef.current
      ) {
        // If the post is already loaded, scroll to it
        collectionRef.current?.scrollToPostAtIndex?.(anchorIndex);
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
          <ComponentsKitContextProvider>
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
                                  <PostCollectionContext.Provider
                                    value={{
                                      channel,
                                      editingPost,
                                      goToImageViewer,
                                      goToPost,
                                      hasNewerPosts,
                                      hasOlderPosts,
                                      headerMode,
                                      initialChannelUnread,
                                      onPressDelete,
                                      onPressRetry,
                                      onScrollEndReached,
                                      onScrollStartReached,
                                      posts: posts ?? undefined,
                                      selectedPostId,
                                      setEditingPost,
                                      LegacyPostView: PostView,
                                      PostView: ConnectedPostView,
                                    }}
                                  >
                                    <PostCollectionView
                                      collectionRef={collectionRef}
                                      channel={channel}
                                    />
                                  </PostCollectionContext.Provider>
                                </View>
                              )}
                            </AnimatePresence>

                            {canWrite &&
                              (channel.contentConfiguration == null ? (
                                <>
                                  {isChatChannel &&
                                    !channel.isDmInvite &&
                                    (negotiationMatch ? (
                                      <DraftInputView
                                        draftInputContext={draftInputContext}
                                        type={DraftInputId.chat}
                                      />
                                    ) : (
                                      <SafeAreaView
                                        edges={['right', 'left', 'bottom']}
                                      >
                                        <NegotionMismatchNotice />
                                      </SafeAreaView>
                                    ))}

                                  {channel.type === 'gallery' && (
                                    <DraftInputView
                                      draftInputContext={draftInputContext}
                                      type={DraftInputId.gallery}
                                    />
                                  )}

                                  {channel.type === 'notebook' && (
                                    <DraftInputView
                                      draftInputContext={draftInputContext}
                                      type={DraftInputId.notebook}
                                    />
                                  )}
                                </>
                              ) : (
                                <DraftInputView
                                  draftInputContext={draftInputContext}
                                  type={channel.contentConfiguration.draftInput}
                                />
                              ))}

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
                              goBack={handleGoBack}
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
          </ComponentsKitContextProvider>
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
