import { useIsFocused } from '@react-navigation/native';
import {
  DraftInputId,
  UploadedImageAttachment,
  finalizeAndSendPost,
  isChatChannel as getIsChatChannel,
  sendPost,
  useChannelPreview,
  useGroupPreview,
  usePostReference as usePostReferenceHook,
  usePostWithRelations,
} from '@tloncorp/shared';
import {
  ChannelContentConfiguration,
  isDmChannelId,
  isGroupDmChannelId,
} from '@tloncorp/shared/api';
import * as db from '@tloncorp/shared/db';
import { JSONContent, Story } from '@tloncorp/shared/urbit';
import { useIsWindowNarrow } from '@tloncorp/ui';
import { ImagePickerAsset } from 'expo-image-picker';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AnimatePresence,
  View,
  YStack,
  getVariableValue,
  useTheme,
} from 'tamagui';

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
import { DraftInputContext } from '../draftInputs';
import { DraftInputHandle, GalleryDraftType } from '../draftInputs/shared';
import {
  ConnectedPostView,
  PostCollectionHandle,
} from '../postCollectionViews/shared';
import { ChannelHeader, ChannelHeaderItemsProvider } from './ChannelHeader';
import { DmInviteOptions } from './DmInviteOptions';
import { DraftInputView } from './DraftInputView';
import { PostView } from './PostView';
import { ReadOnlyNotice } from './ReadOnlyNotice';

//TODO implement usePost and useChannel
const useApp = () => {};

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
  goToImageViewer: (post: db.Post, imageUri?: string) => void;
  goToSearch: () => void;
  goToUserProfile: (userId: string) => void;
  goToEditChannel?: (groupId: string, channelId: string) => void;
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
  editPost: (post: db.Post, content: Story) => Promise<void>;
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
      groupError, // Not currently used but available if needed for error handling
      goBack,
      goToChatDetails,
      goToSearch,
      goToImageViewer,
      goToPost,
      goToDm,
      goToUserProfile,
      goToEditChannel,
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
      editPost,
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
    const isSingleChannelGroup = group?.channels?.length === 1;

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

    const handleGoToEditChannel = useCallback(() => {
      if (!channel.groupId) return;

      if (isSingleChannelGroup) {
        return;
      } else {
        if (goToEditChannel) {
          goToEditChannel(channel.groupId, channel.id);
        }
      }
    }, [goToEditChannel, channel.groupId, channel.id, group?.channels?.length]);
    const { attachAssets } = useAttachmentContext();

    const inView = useIsFocused();
    const hasLoaded = !!(posts && channel);
    const hasUnreads = (channel?.unread?.countWithoutThreads ?? 0) > 0;
    useEffect(() => {
      if (hasUnreads && hasLoaded && inView) {
        markRead();
      }
    }, [hasUnreads, hasLoaded, inView, markRead]);

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

    const { uploadAssets, clearAttachments } = useAttachmentContext();

    const handleImageDrop = useCallback(
      async (assets: ImagePickerAsset[]) => {
        if (channel.type !== 'gallery') {
          attachAssets(assets);
          return;
        }

        try {
          const uploadedAttachments = await uploadAssets(assets);

          for (const attachment of uploadedAttachments) {
            const story: Story = [
              {
                block: {
                  image: {
                    src: UploadedImageAttachment.uri(attachment),
                    height: attachment.file.height || 0,
                    width: attachment.file.width || 0,
                    alt: 'image',
                  },
                },
              },
            ];

            // Send the post with just this image
            await sendPost({
              channelId: channel.id,
              content: story,
            });
          }
        } catch (error) {
          console.error('Error handling image drop:', error);
        } finally {
          clearAttachments();
        }
      },
      [channel, uploadAssets, attachAssets, clearAttachments]
    );

    /** when `null`, input is not shown or presentation is unknown */
    const [draftInputPresentationMode, setDraftInputPresentationMode] =
      useState<null | 'fullscreen' | 'inline'>(null);

    const draftInputRef = useRef<DraftInputHandle>(null);

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
        editPost,
        editingPost,
        getDraft,
        group,
        onPresentationModeChange: setDraftInputPresentationMode,
        sendPost: async (content, channelId, metadata) => {
          await sendPost({
            channelId,
            content,
            metadata,
          });
        },
        sendPostFromDraft: finalizeAndSendPost,
        setEditingPost,
        setShouldBlur: setInputShouldBlur,
        shouldBlur: inputShouldBlur,
        storeDraft,
      }),
      [
        channel,
        clearDraft,
        editPost,
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
                          showSpinner={isLoadingPosts}
                          showSearchButton={
                            channel.type === 'chat' ||
                            channel.type === 'dm' ||
                            channel.type === 'groupDm'
                          }
                          showEditButton={
                            isGroupAdmin &&
                            !isSingleChannelGroup &&
                            !!channel.groupId &&
                            (channel.type === 'chat' ||
                              channel.type === 'notebook' ||
                              channel.type === 'gallery') &&
                            draftInputPresentationMode !== 'fullscreen'
                          }
                          goToEdit={handleGoToEditChannel}
                        />
                        <YStack alignItems="stretch" flex={1}>
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
                                    goToImageViewer,
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
