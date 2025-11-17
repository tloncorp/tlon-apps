import {
  Attachment,
  DraftInputId,
  isChatChannel as getIsChatChannel,
  makePrettyDayAndTime,
  useDebouncedValue,
} from '@tloncorp/shared';
import { ChannelContentConfiguration } from '@tloncorp/shared/api';
import * as db from '@tloncorp/shared/db';
import type * as domain from '@tloncorp/shared/domain';
import * as store from '@tloncorp/shared/store';
import * as urbit from '@tloncorp/shared/urbit';
import { JSONContent, Story } from '@tloncorp/shared/urbit';
import { Carousel, ForwardingProps } from '@tloncorp/ui';
import { KeyboardAvoidingView } from '@tloncorp/ui';
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, YStack } from 'tamagui';

import { useConnectionStatus } from '../../features/top/useConnectionStatus';
import { useChannelNavigation } from '../../hooks/useChannelNavigation';
import {
  ChannelProvider,
  NavigationProvider,
  useAttachmentContext,
  useCurrentUserId,
  useStore,
} from '../contexts';
import * as utils from '../utils';
import BareChatInput from './BareChatInput';
import { BigInput } from './BigInput';
import {
  ChannelHeader,
  ChannelHeaderItemsProvider,
} from './Channel/ChannelHeader';
import { DraftInputView } from './Channel/DraftInputView';
import { DetailView } from './DetailView';
import { FileDrop } from './FileDrop';
import { GroupPreviewAction, GroupPreviewSheet } from './GroupPreviewSheet';

const FocusedPostContext = createContext<{
  focusedPost: db.Post | null;
  setFocusedPost: (post: db.Post | null) => void;
}>(
  (() => {
    let focusedPost: db.Post | null = null;
    return {
      focusedPost,
      setFocusedPost: (post: db.Post | null) => {
        focusedPost = post;
      },
    };
  })()
);

interface ChannelContext {
  group: db.Group | null;
  editingPost?: db.Post;
  setEditingPost?: (post: db.Post | undefined) => void;
  editPost: (
    post: db.Post,
    content: Story,
    parentId?: string,
    metadata?: db.PostMetadata
  ) => Promise<void>;
  negotiationMatch: boolean;
  onPressRetry?: (post: db.Post) => Promise<void>;
  onPressDelete: (post: db.Post) => void;
}

interface GalleryDraftInputProps {
  channel: db.Channel;
  editPost: (
    post: db.Post,
    content: Story,
    parentId?: string,
    metadata?: db.PostMetadata
  ) => Promise<void>;
  editingPost?: db.Post;
  getDraft: (draftType?: string) => Promise<JSONContent | null>;
  group: db.Group | null;
  clearDraft: (draftType?: string) => Promise<void>;
  setEditingPost?: (post: db.Post | undefined) => void;
  setShouldBlur: (shouldBlur: boolean) => void;
  shouldBlur: boolean;
  storeDraft: (content: JSONContent, draftType?: string) => Promise<void>;
}

const GalleryDraftInput = memo(function GalleryDraftInput({
  channel,
  editPost,
  editingPost,
  getDraft,
  group,
  clearDraft,
  setEditingPost,
  setShouldBlur,
  shouldBlur,
  storeDraft,
}: GalleryDraftInputProps) {
  const configuration = useMemo(
    () =>
      channel.contentConfiguration == null
        ? undefined
        : ChannelContentConfiguration.draftInput(channel.contentConfiguration)
            .configuration,
    [channel.contentConfiguration]
  );

  const noOpCallbacks = useMemo(
    () => ({
      onPresentationModeChange: () => {},
      sendPost: async () => {},
      sendPostFromDraft: async () => {},
    }),
    []
  );

  const draftInputContext = useMemo(
    () => ({
      configuration,
      draftInputRef: { current: null },
      editPost,
      editingPost,
      getDraft,
      group,
      channel,
      clearDraft,
      onPresentationModeChange: noOpCallbacks.onPresentationModeChange,
      sendPost: noOpCallbacks.sendPost,
      sendPostFromDraft: noOpCallbacks.sendPostFromDraft,
      setEditingPost,
      setShouldBlur,
      shouldBlur,
      storeDraft,
    }),
    [
      configuration,
      editPost,
      editingPost,
      getDraft,
      group,
      channel,
      clearDraft,
      noOpCallbacks.onPresentationModeChange,
      noOpCallbacks.sendPost,
      noOpCallbacks.sendPostFromDraft,
      setEditingPost,
      setShouldBlur,
      shouldBlur,
      storeDraft,
    ]
  );

  return (
    <DraftInputView
      draftInputContext={draftInputContext}
      type={DraftInputId.gallery}
    />
  );
});

export function PostScreenView({
  channel,
  group,
  parentPost,
  goBack,
  handleGoToImage,
  handleGoToUserProfile,
  editingPost,
  setEditingPost,
  editPost,
  onPressRetry,
  onPressDelete,
  onGroupAction,
  goToDm,
  negotiationMatch,
}: {
  channel: db.Channel;
  parentPost: db.Post | null;
  goBack?: () => void;
  handleGoToImage?: (post: db.Post, uri?: string) => void;
  handleGoToUserProfile: (userId: string) => void;
  onGroupAction: (action: GroupPreviewAction, group: db.Group) => void;
  goToDm: (participants: string[]) => void;
} & ChannelContext) {
  const isWindowNarrow = utils.useIsWindowNarrow();
  const currentUserId = useCurrentUserId();
  const currentUserIsAdmin = utils.useIsAdmin(group?.id ?? '', currentUserId);
  const [groupPreview, setGroupPreview] = useState<db.Group | null>(null);
  const hostConnectionStatus = useConnectionStatus(
    groupPreview?.hostUserId ?? ''
  );

  // If this screen is showing a single post, this is equivalent to `parentPost`.
  // If this screen is a carousel, this is the currently-focused post
  // (`parentPost` does not change when swiping).
  const [focusedPost, setFocusedPost] = useState<db.Post | null>(parentPost);

  const mode: 'single' | 'carousel' = useMemo(() => {
    if (Platform.OS === 'web' || !isWindowNarrow) {
      return 'single';
    }

    // If someone taps a ref to a reply, they drill into the specific reply as
    // a full-screen post. In this case, we always want to show the reply as a
    // `single` post.
    if (parentPost?.parentId != null) {
      return 'single';
    }
    return ['gallery'].includes(channel?.type) ? 'carousel' : 'single';
  }, [channel, parentPost, isWindowNarrow]);

  const showEdit = useMemo(() => {
    // For notebook posts, only show edit button in single mode
    if (channel.type === 'notebook' && mode !== 'single') {
      return false;
    }

    // For gallery posts, allow editing in both single and carousel modes
    // since we're editing the currently focused post in the carousel
    if (channel.type === 'gallery' || mode === 'single') {
      return (
        !editingPost &&
        negotiationMatch &&
        (channel.type === 'notebook' || channel.type === 'gallery') &&
        (parentPost?.authorId === currentUserId || currentUserIsAdmin)
      );
    }

    return false;
  }, [
    mode,
    editingPost,
    negotiationMatch,
    channel.type,
    parentPost?.authorId,
    currentUserId,
    currentUserIsAdmin,
  ]);

  const handleEditPress = useCallback(() => {
    setEditingPost?.(focusedPost ?? undefined);
  }, [focusedPost, setEditingPost]);

  const { bottom } = useSafeAreaInsets();

  const isEditingParent = useMemo(() => {
    return editingPost?.id === focusedPost?.id;
  }, [editingPost, focusedPost]);

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

  const draftCallbacks = store.usePostDraftCallbacks(
    focusedPost == null
      ? null
      : { draftKey: store.draftKeyFor.thread({ parentPostId: focusedPost.id }) }
  );

  const { attachAssets, clearAttachments } = useAttachmentContext();

  const handleGoBack = useCallback(() => {
    if (isEditingParent) {
      setEditingPost?.(undefined);
      // Clear attachments when exiting edit mode to prevent them from
      // appearing in the reply input
      clearAttachments();
      if (channel.type !== 'notebook') {
        goBack?.();
      } else {
        draftCallbacks?.clearDraft();
      }
    } else {
      goBack?.();
    }
  }, [
    channel.type,
    goBack,
    isEditingParent,
    setEditingPost,
    draftCallbacks,
    clearAttachments,
  ]);

  const { navigateToRef } = useChannelNavigation({
    channelId: channel.id,
  });

  return (
    <NavigationProvider
      onGoToUserProfile={handleGoToUserProfile}
      onPressRef={navigateToRef}
      onPressGroupRef={onPressGroupRef}
      onPressGoToDm={goToDm}
    >
      <ChannelHeaderItemsProvider>
        <ChannelProvider value={{ channel }}>
          <FocusedPostContext.Provider
            value={useMemo(
              () => ({
                focusedPost,
                setFocusedPost,
              }),
              [focusedPost]
            )}
          >
            <FileDrop
              paddingBottom={bottom}
              backgroundColor="$background"
              flex={1}
              onAssetsDropped={attachAssets}
            >
              <KeyboardAvoidingView>
                <YStack flex={1} backgroundColor={'$background'}>
                  <ConnectedHeader
                    channel={channel}
                    goBack={handleGoBack}
                    showEditButton={showEdit}
                    goToEdit={handleEditPress}
                  />
                  {parentPost &&
                    (mode === 'single' ? (
                      <SinglePostView
                        {...{
                          channel,
                          editPost,
                          editingPost,
                          goBack,
                          group,
                          handleGoToImage,
                          negotiationMatch,
                          onPressDelete,
                          onPressRetry,
                          parentPost,
                          setEditingPost,
                        }}
                      />
                    ) : (
                      <CarouselPostScreenContent
                        flex={1}
                        width="100%"
                        channelId={channel.id}
                        initialPostId={parentPost.id}
                        channelContext={{
                          editPost,
                          editingPost,
                          group,
                          negotiationMatch,
                          onPressDelete,
                          onPressRetry,
                          setEditingPost,
                        }}
                      />
                    ))}
                  <GroupPreviewSheet
                    group={groupPreview ?? undefined}
                    open={!!groupPreview}
                    onOpenChange={() => setGroupPreview(null)}
                    hostStatus={hostConnectionStatus}
                    onActionComplete={handleGroupAction}
                  />
                </YStack>
              </KeyboardAvoidingView>
            </FileDrop>
          </FocusedPostContext.Provider>
        </ChannelProvider>
      </ChannelHeaderItemsProvider>
    </NavigationProvider>
  );
}

function ConnectedHeader({
  channel,
  ...passedProps
}: ForwardingProps<
  typeof ChannelHeader,
  {
    channel: db.Channel;
  },
  'channel' | 'group' | 'title' | 'showSearchButton' | 'post'
>) {
  const isChatChannel = getIsChatChannel(channel);

  const { focusedPost: parentPost } = useContext(FocusedPostContext);

  const prettyTime = parentPost
    ? makePrettyDayAndTime(new Date(parentPost.receivedAt)).asString
    : '';
  const headerTitle = isChatChannel
    ? `Thread: ${channel?.title || prettyTime}`
    : parentPost?.title && parentPost.title !== ''
      ? parentPost.title
      : 'Post';

  return (
    <ChannelHeader
      channel={channel}
      group={channel.group}
      title={headerTitle}
      showSearchButton={false}
      post={parentPost ?? undefined}
      {...passedProps}
    />
  );
}

function useMarkThreadAsReadEffect(
  opts: {
    shouldMarkRead: boolean;
    channel: db.Channel;
    parent: db.Post;
    mostRecentlyReceivedReply: db.Post;
  } | null
) {
  const store = useStore();
  const markRead = useCallback(() => {
    if (opts == null) {
      return;
    }

    const { channel, parent, mostRecentlyReceivedReply } = opts;
    if (channel && parent && mostRecentlyReceivedReply) {
      store.markThreadRead({
        channel,
        parentPost: parent,
        post: mostRecentlyReceivedReply,
      });
    }
  }, [opts, store]);

  const shouldMarkRead = opts?.shouldMarkRead ?? false;
  useEffect(() => {
    if (shouldMarkRead) {
      markRead();
    }
    // Only want to trigger once per set of params
    // eslint-disable-next-line
  }, [shouldMarkRead]);
}

function SinglePostView({
  channel,
  group,
  editPost,
  editingPost,
  goBack,
  handleGoToImage,
  negotiationMatch,
  onPressDelete,
  onPressRetry,
  parentPost,
  setEditingPost,
}: {
  channel: db.Channel;
  editPost: (
    post: db.Post,
    content: Story,
    parentId?: string,
    metadata?: db.PostMetadata
  ) => Promise<void>;
  editingPost?: db.Post;
  goBack?: () => void;
  group: db.Group | null;
  handleGoToImage?: (post: db.Post, uri?: string) => void;
  negotiationMatch: boolean;
  onPressDelete: (post: db.Post) => void;
  onPressRetry?: (post: db.Post) => Promise<void>;
  parentPost: db.Post;
  setEditingPost?: (post: db.Post | undefined) => void;
}) {
  const groupMembers = group?.members ?? [];
  const groupRoles = group?.roles ?? [];
  const store = useStore();
  const { focusedPost } = useContext(FocusedPostContext);
  const isFocusedPost = focusedPost?.id === parentPost.id;
  const { getDraft, storeDraft, clearDraft } = store.usePostDraftCallbacks({
    draftKey: store.draftKeyFor.thread({ parentPostId: parentPost.id }),
  });

  // for the unread thread divider, we care about the unread state when you enter but don't want it to update over
  // time
  const [initialThreadUnread, setInitialThreadUnread] =
    useState<db.ThreadUnreadState | null>(null);
  useEffect(() => {
    async function initializeChannelUnread() {
      const unread = await db.getThreadUnreadState({ parentId: parentPost.id });
      setInitialThreadUnread(unread ?? null);
    }
    initializeChannelUnread();
  }, [parentPost.id]);

  const { data: threadPosts } = store.useThreadPosts({
    postId: parentPost.id,
    authorId: parentPost.authorId,
    channelId: channel.id,
  });

  const posts = useMemo(() => {
    return parentPost ? [...(threadPosts ?? []), parentPost] : null;
  }, [parentPost, threadPosts]);

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

  const containingProperties: Partial<
    React.ComponentPropsWithoutRef<typeof View>
  > = useMemo(() => {
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

  const hasLoadedReplies = !!(posts && channel && parentPost);
  useMarkThreadAsReadEffect(
    channel == null || parentPost == null || threadPosts?.[0] == null
      ? null
      : {
          channel,
          mostRecentlyReceivedReply: threadPosts[0],
          parent: parentPost,
          shouldMarkRead: isFocusedPost && hasLoadedReplies,
        }
  );

  const sendReply = useCallback(
    async (content: urbit.Story) => {
      await store.sendReply({
        content,
        channel: channel,
        parentId: parentPost.id,
        parentAuthor: parentPost.authorId,
      });
    },
    [channel, parentPost, store]
  );

  const sendReplyFromDraft = useCallback(
    async (draft: domain.PostDataDraft) => {
      if (draft.isEdit) {
        await store.finalizeAndSendPost(draft);
      } else {
        const finalized = await store.finalizePostDraft(draft);
        await store.sendReply({
          content: finalized.content,
          channel: channel,
          parentId: parentPost.id,
          parentAuthor: parentPost.authorId,
        });
      }
    },
    [channel, parentPost, store]
  );

  const isChatLike = useMemo(
    () =>
      channel.type === 'chat' ||
      channel.type === 'dm' ||
      channel.type === 'groupDm',
    [channel.type]
  );

  return (
    <YStack flex={1}>
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
          editorIsFocused={false}
        />
      ) : null}

      {negotiationMatch &&
        channel &&
        canWrite &&
        !(
          isEditingParent &&
          (channel.type === 'notebook' || channel.type === 'gallery')
        ) && (
          <View id="reply-container" {...containingProperties}>
            <BareChatInput
              placeholder="Reply"
              groupId={channel.groupId}
              shouldBlur={inputShouldBlur}
              setShouldBlur={setInputShouldBlur}
              sendPost={sendReply}
              sendPostFromDraft={sendReplyFromDraft}
              channelId={channel.id}
              groupMembers={groupMembers}
              groupRoles={groupRoles}
              {...bareInputDraftProps}
              editingPost={editingPost}
              setEditingPost={setEditingPost}
              editPost={editPost}
              channelType="chat"
              showAttachmentButton={isChatLike}
              showInlineAttachments
              shouldAutoFocus={
                (isChatLike && parentPost?.replyCount === 0) || !!editingPost
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
        <View
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          backgroundColor="$background"
        >
          {channel.type === 'gallery' ? (
            <GalleryDraftInput
              channel={channel}
              editPost={editPost}
              editingPost={editingPost}
              getDraft={getDraft}
              group={group}
              clearDraft={clearDraft}
              setEditingPost={setEditingPost}
              setShouldBlur={setInputShouldBlur}
              shouldBlur={inputShouldBlur}
              storeDraft={storeDraft}
            />
          ) : (
            <BigInput
              channelType={urbit.getChannelType(parentPost.channelId)}
              channelId={parentPost?.channelId}
              editingPost={editingPost}
              setEditingPost={setEditingPost}
              editPost={editPost}
              shouldBlur={inputShouldBlur}
              setShouldBlur={setInputShouldBlur}
              sendPost={async () => {}}
              sendPostFromDraft={async () => {}}
              getDraft={getDraft}
              storeDraft={storeDraft}
              clearDraft={clearDraft}
              groupMembers={groupMembers}
              groupRoles={groupRoles}
            />
          )}
        </View>
      ) : null}
    </YStack>
  );
}

function CarouselPostScreenContent({
  channelId,
  initialPostId,
  ...passedProps
}: ForwardingProps<
  typeof PresentationalCarouselPostScreenContent,
  {
    channelId: string;
    initialPostId: string;
  },
  'posts' | 'channel' | 'initialPostIndex' | 'fetchNewerPage' | 'fetchOlderPage'
>) {
  const {
    posts,
    query: { fetchNextPage, fetchPreviousPage },
  } = store.useChannelPosts({
    enabled: true,
    channelId: channelId,
    count: 10,
    mode: 'around',
    cursorPostId: initialPostId,
    firstPageCount: 50,
    filterDeleted: true,
  });
  const { data: channel } = store.useChannel({ id: channelId });

  const initialPostIndex = useMemo(() => {
    let index: number | undefined = undefined;
    if (posts != null) {
      index = posts.findIndex((p) => p.id === initialPostId);
    }
    if (index === -1) {
      index = undefined;
    }
    return index;
  }, [posts, initialPostId]);

  return (
    <PresentationalCarouselPostScreenContent
      {...{
        posts: posts ?? null,
        channel: channel ?? null,
        initialPostIndex,
        fetchNewerPage: fetchNextPage,
        fetchOlderPage: fetchPreviousPage,
        ...passedProps,
      }}
    />
  );
}

export function PresentationalCarouselPostScreenContent({
  posts,
  channel,
  initialPostIndex,
  fetchNewerPage,
  fetchOlderPage,
  channelContext,
  ...passedProps
}: ForwardingProps<
  typeof YStack,
  {
    posts: db.Post[] | null;
    channel: db.Channel | null;
    initialPostIndex?: number;
    fetchNewerPage: () => void;
    fetchOlderPage: () => void;
    channelContext: ChannelContext;
  }
>) {
  const [visibleIndex, setVisibleIndex] = useState(initialPostIndex ?? 0);

  /*
   * Without this `useDebounceValue`, the header will flicker when adding
   * older posts. With `maintainVisibleContentPosition`, adding new posts to the
   * beginning of the scroll yields a frame where the visible index is
   * incorrect (i.e. a frame between updating content height/offset and
   * receiving the corresponding `onScroll`).
   */
  const headerPost = useDebouncedValue(
    posts?.[visibleIndex],
    10 // found through experimentation
  );

  const { setFocusedPost } = useContext(FocusedPostContext);
  useEffect(() => {
    setFocusedPost(headerPost ?? null);
  }, [headerPost, setFocusedPost]);

  // `Carousel's `onStartReached`/`onEndReached` are called once per unique
  // `children` value (a React Native quirk). If we don't memoize this children
  // list, `onStartReached`/`onEndReached` are called inconsistently on
  // `Carousel`.
  const carouselChildren = useMemo(
    () =>
      channel != null &&
      posts?.map((post) => (
        <CarouselPost
          key={post.id}
          {...{
            ...channelContext,
            channel,
            parentPost: post,
          }}
        />
      )),
    [posts, channel, channelContext]
  );

  return channel && posts?.length ? (
    <YStack {...passedProps}>
      <Carousel
        flex={1}
        onVisibleIndexChange={setVisibleIndex}
        initialVisibleIndex={initialPostIndex}
        scrollDirection="horizontal"
        hideOverlayOnTap={false}
        flatListProps={{
          onEndReached: fetchNewerPage,
          onStartReached: fetchOlderPage,
          initialNumToRender: 3,
          maxToRenderPerBatch: 3,
          windowSize: 3,
          keyboardShouldPersistTaps: 'handled',
          scrollEnabled: !channelContext.editingPost,
          // Fix for: TextInput loses focus in FlatList on Android
          // see: https://github.com/facebook/react-native/issues/23916#issuecomment-472854627
          removeClippedSubviews: false,
        }}
      >
        {carouselChildren}
      </Carousel>
    </YStack>
  ) : null;
}

function _CarouselPost({
  channel,
  parentPost,
  ...channelContext
}: { channel: db.Channel; parentPost: db.Post } & ChannelContext) {
  return (
    <Carousel.Item flex={1}>
      <SinglePostView
        {...{
          channel,
          ...channelContext,
          parentPost,
        }}
      />
    </Carousel.Item>
  );
}
const CarouselPost = memo(_CarouselPost);
