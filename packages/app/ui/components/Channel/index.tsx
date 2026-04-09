import { useIsFocused } from '@react-navigation/native';
import {
  ChannelContentConfiguration,
  isDmChannelId,
  isGroupDmChannelId,
} from '@tloncorp/api';
import { JSONContent } from '@tloncorp/api/urbit';
import {
  Attachment,
  DraftInputId,
  finalizeAndSendPost,
  isChatChannel as getIsChatChannel,
  uploadAsset,
  useChannelPreview,
  useGroupPreview,
  usePostReference as usePostReferenceHook,
  usePostWithRelations,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as domain from '@tloncorp/shared/domain';
import * as logic from '@tloncorp/shared/logic';
import { useIsWindowNarrow } from '@tloncorp/ui';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import {
  AnimatePresence,
  View,
  YStack,
  getVariableValue,
  useTheme,
} from 'tamagui';

import { useIsUserActive } from '../../../hooks/useUserActivity';
import {
  ChannelProvider,
  GroupsProvider,
  NavigationProvider,
  useCurrentUserId,
} from '../../contexts';
import { useAttachmentContext } from '../../contexts/attachment';
import { PostCollectionContext } from '../../contexts/postCollection';
import { RequestsProvider } from '../../contexts/requests';
import { ScrollContextProvider } from '../../contexts/scroll';
import * as utils from '../../utils';
import { FileDrop } from '../FileDrop';
import { GroupPreviewAction, GroupPreviewSheet } from '../GroupPreviewSheet';
import { ChannelConfigurationBar } from '../ManageChannels/CreateChannelSheet';
import { PostCollectionView } from '../PostCollectionView';
import SystemNotices from '../SystemNotices';
import { DraftInputContext } from '../draftInputs';
import { DraftInputHandle, GalleryDraftType } from '../draftInputs/shared';
import {
  ConnectedPostView,
  PostCollectionHandle,
} from '../postCollectionViews/shared';
import { ChannelHeader, ChannelHeaderItemsProvider } from './ChannelHeader';
import { DmInviteOptions } from './DmInviteOptions';
import { DraftInputView } from './DraftInputView';
import { PinnedPostBanner } from './PinnedPostBanner';
import { PostView } from './PostView';
import { ReadOnlyNotice } from './ReadOnlyNotice';

//TODO implement usePost and useChannel
const useApp = () => {};
const HEADER_LOADING_SHOW_DELAY_MS = 180;
const HEADER_LOADING_MIN_VISIBLE_MS = 420;

interface ChannelProps {
  channel: db.Channel;
  initialChannelUnread?: db.ChannelUnread | null;
  selectedPostId?: string | null;
  posts: db.Post[] | null;
  group: db.Group | null;
  groupIsLoading?: boolean;
  groupError?: Error | null;
  goBack: () => void;
  goToChatDetails?: () => void;
  goToPost: (post: db.Post) => void;
  goToDm: (participants: string[]) => void;
  goToGroupSettings: () => void;
  goToMediaViewer: (post: db.Post, imageUri?: string) => void;
  goToSearch: () => void;
  goToUserProfile: (userId: string) => void;
  goToChannelDetails?: (groupId: string, channelId: string) => void;
  onScrollEndReached?: () => void;
  onScrollStartReached?: () => void;
  isLoadingPosts?: boolean;
  loadPostsError?: Error | null;
  onPressRef: (channel: db.Channel, post: db.Post) => void;
  markRead: () => void;
  usePost: typeof usePostWithRelations;
  useGroup: typeof useGroupPreview;
  usePostReference: typeof usePostReferenceHook;
  onGroupAction: (action: GroupPreviewAction, group: db.Group) => void;
  useChannel: typeof useChannelPreview;
  storeDraft: (
    draft: JSONContent,
    draftType?: GalleryDraftType
  ) => Promise<void>;
  clearDraft: (draftType?: GalleryDraftType) => Promise<void>;
  getDraft: (draftType?: GalleryDraftType) => Promise<JSONContent | null>;
  editingPost?: db.Post;
  setEditingPost?: (post: db.Post | undefined) => void;
  onPressRetrySend: (post: db.Post) => Promise<void>;
  onPressRetryLoad: () => void;
  onPressDelete: (post: db.Post) => void;
  negotiationMatch: boolean;
  hasNewerPosts?: boolean;
  hasOlderPosts?: boolean;
  startDraft?: boolean;
  onPressScrollToBottom?: () => void;
}

interface ChannelMethods {
  openChannelConfigurationBar: () => void;
}

export const Channel = forwardRef<ChannelMethods, ChannelProps>(
  function Channel(
    {
      channel,
      initialChannelUnread,
      posts,
      selectedPostId,
      group,
      groupIsLoading,
      // groupError, // Not currently used but available if needed for error handling
      goBack,
      goToChatDetails,
      goToSearch,
      goToMediaViewer,
      goToPost,
      goToDm,
      goToUserProfile,
      goToChannelDetails,
      goToGroupSettings,
      onScrollEndReached,
      onScrollStartReached,
      isLoadingPosts,
      loadPostsError,
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
      onPressRetryLoad,
      onPressRetrySend,
      onPressDelete,
      negotiationMatch,
      hasNewerPosts,
      hasOlderPosts,
      startDraft,
      onPressScrollToBottom,
    },
    ref
  ) {
    const [editingConfiguration, setEditingConfiguration] = useState(false);
    const [inputShouldBlur, setInputShouldBlur] = useState(false);
    const [groupPreview, setGroupPreview] = useState<db.Group | null>(null);
    const [showHeaderLoading, setShowHeaderLoading] = useState(false);
    const headerLoadingShownAtRef = useRef<number | null>(null);
    const headerLoadingShowTimeoutRef = useRef<ReturnType<
      typeof setTimeout
    > | null>(null);
    const headerLoadingHideTimeoutRef = useRef<ReturnType<
      typeof setTimeout
    > | null>(null);
    const title = utils.useChannelTitle(channel);
    const groups = useMemo(() => (group ? [group] : null), [group]);
    const currentUserId = useCurrentUserId();
    const canWrite = utils.useCanWrite(channel, currentUserId);
    const canRead = utils.useCanRead(channel, currentUserId);
    const isGroupAdmin = utils.useIsAdmin(channel.groupId ?? '', currentUserId);
    const collectionRef = useRef<PostCollectionHandle>(null);

    const isChatChannel = channel ? getIsChatChannel(channel) : true;
    const isDM = isDmChannelId(channel.id);
    const isGroupDm = isGroupDmChannelId(channel.id);
    const isNotebookOrGallery =
      channel.type === 'notebook' || channel.type === 'gallery';
    const pinnedPostId = logic.getPinnedPostId(channel);
    // For DMs, get the other participant's ID
    const dmRecipientId = useMemo(() => {
      if (isDM && channel.members) {
        const otherMember = channel.members.find(
          (member) => member.contactId !== currentUserId
        );
        return otherMember?.contactId;
      }
      return undefined;
    }, [isDM, channel.members, currentUserId]);

    const handleGoToProfile = useCallback(() => {
      if (dmRecipientId) {
        goToUserProfile(dmRecipientId);
      }
    }, [dmRecipientId, goToUserProfile]);

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

    const { attachAssets } = useAttachmentContext();

    const inView = useIsFocused();
    const isUserActive = useIsUserActive();
    const hasLoaded = !!(posts && channel);
    const hasUnreads = (channel?.unread?.countWithoutThreads ?? 0) > 0;

    useEffect(() => {
      const clearShowTimeout = () => {
        if (headerLoadingShowTimeoutRef.current) {
          clearTimeout(headerLoadingShowTimeoutRef.current);
          headerLoadingShowTimeoutRef.current = null;
        }
      };
      const clearHideTimeout = () => {
        if (headerLoadingHideTimeoutRef.current) {
          clearTimeout(headerLoadingHideTimeoutRef.current);
          headerLoadingHideTimeoutRef.current = null;
        }
      };

      if (isLoadingPosts) {
        clearHideTimeout();
        if (showHeaderLoading || headerLoadingShowTimeoutRef.current) {
          return;
        }

        headerLoadingShowTimeoutRef.current = setTimeout(() => {
          headerLoadingShownAtRef.current = Date.now();
          setShowHeaderLoading(true);
          headerLoadingShowTimeoutRef.current = null;
        }, HEADER_LOADING_SHOW_DELAY_MS);
        return;
      }

      clearShowTimeout();
      clearHideTimeout();

      if (!showHeaderLoading) {
        headerLoadingShownAtRef.current = null;
        return;
      }

      const elapsed = headerLoadingShownAtRef.current
        ? Date.now() - headerLoadingShownAtRef.current
        : 0;
      const hideDelay = Math.max(HEADER_LOADING_MIN_VISIBLE_MS - elapsed, 0);

      headerLoadingHideTimeoutRef.current = setTimeout(() => {
        headerLoadingShownAtRef.current = null;
        setShowHeaderLoading(false);
        headerLoadingHideTimeoutRef.current = null;
      }, hideDelay);
    }, [isLoadingPosts, showHeaderLoading]);

    useEffect(() => {
      return () => {
        if (headerLoadingShowTimeoutRef.current) {
          clearTimeout(headerLoadingShowTimeoutRef.current);
        }
        if (headerLoadingHideTimeoutRef.current) {
          clearTimeout(headerLoadingHideTimeoutRef.current);
        }
      };
    }, []);

    useEffect(() => {
      // Only mark as read when user is actively using the app (not idle)
      // This prevents auto-marking on desktop when user is AFK
      if (hasUnreads && hasLoaded && inView && isUserActive) {
        // add slight delay to allow high priority tasks to hit the sync queue first
        setTimeout(() => {
          markRead();
        }, 150);
      }
    }, [hasUnreads, hasLoaded, inView, isUserActive, markRead]);

    const handleRefPress = useCallback(
      (refChannel: db.Channel, post: db.Post) => {
        const anchorIndex = posts?.findIndex((p) => p.id === post.id) ?? -1;

        if (
          refChannel.id === channel.id &&
          anchorIndex !== -1 &&
          collectionRef.current
        ) {
          // If the post is already loaded, scroll to it and highlight
          collectionRef.current?.scrollToPostAtIndex?.(anchorIndex, 0.5);
          collectionRef.current?.highlightPost?.(post.id);
          return;
        }

        onPressRef(refChannel, post);
      },
      [onPressRef, posts, channel]
    );

    const { clearAttachments } = useAttachmentContext();

    const handleImageDrop = useCallback(
      async (uploadIntents: Attachment.UploadIntent[]) => {
        if (channel.type !== 'gallery') {
          attachAssets(uploadIntents);
          return;
        }

        try {
          // Start uploads for gallery channels (uploads are started automatically
          // via useEffect in AttachmentContext for non-gallery channels)
          // Gallery posts can't have more than one attachment. Send each dropped attachment separately.
          for (const uploadIntent of uploadIntents) {
            await uploadAsset(uploadIntent, true);
            const draft: domain.PostDataDraft = {
              channelId: channel.id,
              content: [],
              attachments: [Attachment.fromUploadIntent(uploadIntent)],
              channelType: channel.type,
              replyToPostId: null,
              isEdit: false,
            };
            await finalizeAndSendPost(draft);
          }
        } catch (error) {
          console.error('Error handling image drop:', error);
        } finally {
          clearAttachments();
          for (const intent of uploadIntents) {
            if (
              intent.type === 'image' &&
              intent.asset.uri.startsWith('blob:')
            ) {
              URL.revokeObjectURL(intent.asset.uri);
            }
          }
        }
      },
      [channel, attachAssets, clearAttachments]
    );

    /** when `null`, input is not shown or presentation is unknown */
    const [draftInputPresentationMode, setDraftInputPresentationMode] =
      useState<null | 'fullscreen' | 'inline'>(null);

    const draftInputRef = useRef<DraftInputHandle>(null);

    // Helper to scroll to new message - shared by sendPost and sendPostFromDraft
    const scrollToNewMessage = useCallback(() => {
      requestAnimationFrame(() => {
        collectionRef.current?.scrollToStart?.({ animated: true });
      });
    }, []);

    const draftInputContext = useMemo(
      (): DraftInputContext => ({
        channel,
        clearDraft,
        configuration:
          channel.contentConfiguration == null
            ? undefined
            : ChannelContentConfiguration.draftInput(
                channel.contentConfiguration
              ).configuration,
        draftInputRef,
        editingPost,
        getDraft,
        group,
        onPresentationModeChange: setDraftInputPresentationMode,
        sendPostFromDraft: async (draft) => {
          setEditingPost?.(undefined);
          await finalizeAndSendPost(draft);
          if (!draft.isEdit) {
            scrollToNewMessage();
          }
        },
        setEditingPost,
        setShouldBlur: setInputShouldBlur,
        shouldBlur: inputShouldBlur,
        storeDraft,
      }),
      [
        scrollToNewMessage,
        channel,
        clearDraft,
        editingPost,
        getDraft,
        group,
        inputShouldBlur,
        setEditingPost,
        storeDraft,
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

    useEffect(() => {
      if (startDraft) {
        draftInputRef.current?.startDraft?.();
      }
    }, [startDraft]);

    const isNarrow = useIsWindowNarrow();

    const backgroundColor = getVariableValue(useTheme().background);

    useImperativeHandle(
      ref,
      () => ({
        openChannelConfigurationBar() {
          setEditingConfiguration(true);
        },
      }),
      []
    );

    const channelProviderValue = useMemo(() => ({ channel }), [channel]);

    const includeJoinRequestNotice = useMemo(() => {
      // we want to avoid duplicating the notice on both the channels list and inline here

      // if group is multi-channel, skip
      const validGroup = group && (group.channels?.length ?? 0) === 1;

      // skip web since currently all groups show the channel sidebar
      const validPlatform = Platform.OS !== 'web';

      return validGroup && validPlatform;
    }, [group]);

    const shouldShowPinnedPostBanner = useMemo(() => {
      if (!pinnedPostId) return false;
      if (!isNotebookOrGallery) return true;
      return editingPost == null && draftInputPresentationMode !== 'fullscreen';
    }, [
      pinnedPostId,
      isNotebookOrGallery,
      editingPost,
      draftInputPresentationMode,
    ]);

    return (
      <ScrollContextProvider>
        <GroupsProvider groups={groups}>
          <ChannelProvider value={channelProviderValue}>
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
                onGoToGroupSettings={goToGroupSettings}
              >
                <View backgroundColor={backgroundColor} flex={1}>
                  <FileDrop
                    flexDirection="column"
                    justifyContent="space-between"
                    width="100%"
                    height="100%"
                    onAssetsDropped={handleImageDrop}
                  >
                    <ChannelHeaderItemsProvider>
                      <>
                        <ChannelHeader
                          channel={channel}
                          group={group}
                          title={title ?? ''}
                          description={''}
                          goBack={
                            isNarrow ||
                            draftInputPresentationMode === 'fullscreen'
                              ? handleGoBack
                              : undefined
                          }
                          goToChatDetails={goToChatDetails}
                          goToProfile={handleGoToProfile}
                          goToSearch={goToSearch}
                          showSpinner={showHeaderLoading}
                          showSearchButton={
                            channel.type === 'chat' ||
                            channel.type === 'dm' ||
                            channel.type === 'groupDm'
                          }
                        />
                        {shouldShowPinnedPostBanner && (
                          <PinnedPostBanner
                            channel={channel}
                            onPressPost={goToPost}
                          />
                        )}
                        <YStack alignItems="stretch" flex={1}>
                          {includeJoinRequestNotice && (
                            <SystemNotices.ConnectedJoinRequestNotice
                              group={group}
                              onViewRequests={goToGroupSettings}
                            />
                          )}
                          <AnimatePresence>
                            {draftInputPresentationMode !== 'fullscreen' && (
                              <View flex={1}>
                                <PostCollectionContext.Provider
                                  value={{
                                    channel,
                                    collectionConfiguration:
                                      channel.contentConfiguration == null
                                        ? undefined
                                        : ChannelContentConfiguration.defaultPostCollectionRenderer(
                                            channel.contentConfiguration
                                          ).configuration,
                                    editingPost,
                                    goToMediaViewer,
                                    goToPost,
                                    hasNewerPosts,
                                    hasOlderPosts,
                                    initialChannelUnread,
                                    isLoadingPosts: isLoadingPosts ?? false,
                                    loadPostsError,
                                    onPressDelete,
                                    onPressRetrySend,
                                    onPressRetryLoad,
                                    onScrollEndReached,
                                    onScrollStartReached,
                                    posts: posts ?? undefined,
                                    scrollToBottom: onPressScrollToBottom,
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

                          {!canRead ||
                          !canWrite ||
                          !negotiationMatch ||
                          (channel.groupId && !group && !groupIsLoading) ? (
                            <ReadOnlyNotice
                              type={
                                channel.groupId && !group && !groupIsLoading
                                  ? 'group-deleted'
                                  : !canRead
                                    ? 'no-longer-read'
                                    : !canWrite
                                      ? 'read-only'
                                      : isDM
                                        ? 'dm-mismatch'
                                        : isGroupDm
                                          ? 'group-dm-mismatch'
                                          : 'channel-mismatch'
                              }
                            />
                          ) : channel.contentConfiguration == null ? (
                            <>
                              {isChatChannel && !channel.isDmInvite && (
                                <DraftInputView
                                  draftInputContext={draftInputContext}
                                  type={DraftInputId.chat}
                                />
                              )}

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
                              type={
                                ChannelContentConfiguration.draftInput(
                                  channel.contentConfiguration
                                ).id
                              }
                            />
                          )}

                          {channel.isDmInvite && (
                            <DmInviteOptions
                              channel={channel}
                              goBack={goBack}
                            />
                          )}
                          {editingConfiguration && (
                            <ChannelConfigurationBar
                              channel={channel}
                              onPressDone={() => setEditingConfiguration(false)}
                            />
                          )}
                        </YStack>
                        <GroupPreviewSheet
                          group={groupPreview ?? undefined}
                          open={!!groupPreview}
                          onOpenChange={() => setGroupPreview(null)}
                          onActionComplete={handleGroupAction}
                        />
                      </>
                    </ChannelHeaderItemsProvider>
                  </FileDrop>
                </View>
              </NavigationProvider>
            </RequestsProvider>
          </ChannelProvider>
        </GroupsProvider>
      </ScrollContextProvider>
    );
  }
);
