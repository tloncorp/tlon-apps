import {
  DraftInputId,
  isChatChannel as getIsChatChannel,
  useChannelPreview,
  useGroupPreview,
  usePostReference as usePostReferenceHook,
  usePostWithRelations,
} from '@tloncorp/shared';
import { ChannelContentConfiguration } from '@tloncorp/shared/api';
import * as db from '@tloncorp/shared/db';
import { JSONContent, Story } from '@tloncorp/shared/urbit';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AnimatePresence,
  SizableText,
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
import { ComponentsKitContextProvider } from '../../contexts/componentsKits';
import { PostCollectionContext } from '../../contexts/postCollection';
import { RequestsProvider } from '../../contexts/requests';
import { ScrollContextProvider } from '../../contexts/scroll';
import useIsWindowNarrow from '../../hooks/useIsWindowNarrow';
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
import { ChannelFooter } from './ChannelFooter';
import { ChannelHeader, ChannelHeaderItemsProvider } from './ChannelHeader';
import { DmInviteOptions } from './DmInviteOptions';
import { DraftInputView } from './DraftInputView';
import { PostView } from './PostView';

export { INITIAL_POSTS_PER_PAGE } from './Scroller';

//TODO implement usePost and useChannel
const useApp = () => {};

interface ChannelProps {
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
  onScrollEndReached?: () => void;
  onScrollStartReached?: () => void;
  isLoadingPosts?: boolean;
  onPressRef: (channel: db.Channel, post: db.Post) => void;
  markRead: () => void;
  usePost: typeof usePostWithRelations;
  useGroup: typeof useGroupPreview;
  usePostReference: typeof usePostReferenceHook;
  onGroupAction: (action: GroupPreviewAction, group: db.Group) => void;
  useChannel: typeof useChannelPreview;
  storeDraft: (draft: JSONContent, draftType?: GalleryDraftType) => void;
  clearDraft: (draftType?: GalleryDraftType) => void;
  getDraft: (draftType?: GalleryDraftType) => Promise<JSONContent | null>;
  editingPost?: db.Post;
  setEditingPost?: (post: db.Post | undefined) => void;
  editPost: (post: db.Post, content: Story) => Promise<void>;
  onPressRetry: (post: db.Post) => Promise<void>;
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
    const { attachAssets } = useAttachmentContext();

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
                  <View backgroundColor={backgroundColor} flex={1}>
                    <FileDrop
                      flexDirection="column"
                      justifyContent="space-between"
                      width="100%"
                      height="100%"
                      onAssetsDropped={attachAssets}
                    >
                      <ChannelHeaderItemsProvider>
                        <>
                          <ChannelHeader
                            channel={channel}
                            group={group}
                            mode={headerMode}
                            title={title ?? ''}
                            goBack={
                              isNarrow ||
                              draftInputPresentationMode === 'fullscreen'
                                ? handleGoBack
                                : undefined
                            }
                            showSearchButton={isChatChannel}
                            goToSearch={goToSearch}
                            goToChannels={goToChannels}
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
                                      headerMode,
                                      initialChannelUnread,
                                      isLoadingPosts: isLoadingPosts ?? false,
                                      onPressDelete,
                                      onPressRetry,
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
                                  type={
                                    ChannelContentConfiguration.draftInput(
                                      channel.contentConfiguration
                                    ).id
                                  }
                                />
                              ))}

                            {channel.isDmInvite && (
                              <DmInviteOptions
                                channel={channel}
                                goBack={goBack}
                              />
                            )}
                            {editingConfiguration && (
                              <ChannelConfigurationBar
                                channel={channel}
                                onPressDone={() =>
                                  setEditingConfiguration(false)
                                }
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
                    </FileDrop>
                  </View>
                </NavigationProvider>
              </RequestsProvider>
            </ComponentsKitContextProvider>
          </ChannelProvider>
        </GroupsProvider>
      </ScrollContextProvider>
    );
  }
);

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
