import {
  isChatChannel as getIsChatChannel,
  useDebouncedValue,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import * as urbit from '@tloncorp/shared/urbit';
import { Story } from '@tloncorp/shared/urbit';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, YStack } from 'tamagui';

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
import { ChannelFooter } from './Channel/ChannelFooter';
import { ChannelHeader } from './Channel/ChannelHeader';
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
  group?: db.Group | null;
  groupMembers: db.ChatMember[];
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
  negotiationMatch: boolean;
  headerMode: 'default' | 'next';
  onPressRetry?: (post: db.Post) => Promise<void>;
  onPressDelete: (post: db.Post) => void;
}

export function PostScreenView({
  channel,
  parentPost,
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
  onGroupAction,
  goToDm,
  negotiationMatch,
  headerMode,
}: {
  channel: db.Channel;
  parentPost: db.Post | null;
  goBack?: () => void;
  handleGoToImage?: (post: db.Post, uri?: string) => void;
  handleGoToUserProfile: (userId: string) => void;
  onGroupAction: (action: GroupPreviewAction, group: db.Group) => void;
  goToDm: (participants: string[]) => void;
} & ChannelContext) {
  const currentUserId = useCurrentUserId();
  const currentUserIsAdmin = utils.useIsAdmin(
    channel.groupId ?? '',
    currentUserId
  );
  const [groupPreview, setGroupPreview] = useState<db.Group | null>(null);

  // If this screen is showing a single post, this is equivalent to `parentPost`.
  // If this screen is a carousel, this is the currently-focused post
  // (`parentPost` does not change when swiping).
  const [focusedPost, setFocusedPost] = useState<db.Post | null>(parentPost);

  const mode: 'single' | 'carousel' = useMemo(() => {
    // If someone taps a ref to a reply, they drill into the specific reply as
    // a full-screen post. In this case, we always want to show the reply as a
    // `single` post.
    if (parentPost?.parentId != null) {
      return 'single';
    }
    return ['gallery'].includes(channel?.type) ? 'carousel' : 'single';
  }, [channel, parentPost]);

  const showEdit = useMemo(() => {
    // This logic assumes this screen only shows a single post - if we're
    // swapping out different posts (e.g. in a carousel), we'll need to rewrite
    // this to look at the currently-focused post.
    // No need to at the moment because we only allow edit in notebooks.
    if (mode !== 'single') {
      return false;
    }

    return (
      !editingPost &&
      channel.type === 'notebook' &&
      (parentPost?.authorId === currentUserId || currentUserIsAdmin)
    );
  }, [
    mode,
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

  // TODO: lost in changes - but this is not working for me in latest
  // release anyways (tried by following a ref to a post in the same
  // thread, which has been loaded & is offscreen)
  // const handleRefPress = useCallback(
  //   (refChannel: db.Channel, post: db.Post) => {
  //     const anchorIndex = posts?.findIndex((p) => p.id === post.id) ?? -1;

  //     if (
  //       refChannel.id === channel.id &&
  //       anchorIndex !== -1 &&
  //       flatListRef.current
  //     ) {
  //       // If the post is already loaded, scroll to it
  //       flatListRef.current?.scrollToIndex({
  //         index: anchorIndex,
  //         animated: false,
  //         viewPosition: 0.5,
  //       });
  //       return;
  //     }

  //     onPressRef(refChannel, post);
  //   },
  //   [onPressRef, channel]
  // );

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
                  mode={headerMode}
                  showEditButton={showEdit}
                  goToEdit={handleEditPress}

                  // When adding the ability to swipe through posts, we lost
                  // the ability to show a spinner based on loading posts. I
                  // don't think we were ever really showing this though, as we
                  // only spun while waiting for DB load, not network load.
                  // showSpinner={isLoadingPosts}
                />
                {parentPost &&
                  (mode === 'single' ? (
                    <SinglePostView
                      {...{
                        channel,
                        clearDraft,
                        editPost,
                        editingPost,
                        getDraft,
                        goBack,
                        groupMembers,
                        handleGoToImage,
                        headerMode,
                        negotiationMatch,
                        onPressDelete,
                        onPressRetry,
                        parentPost,
                        setEditingPost,
                        storeDraft,
                      }}
                    />
                  ) : (
                    <CarouselPostScreenContent
                      flex={1}
                      width="100%"
                      channelId={channel.id}
                      initialPostId={parentPost.id}
                      channelContext={{
                        clearDraft,
                        editPost,
                        editingPost,
                        getDraft,
                        groupMembers,
                        headerMode,
                        negotiationMatch,
                        onPressDelete,
                        onPressRetry,
                        setEditingPost,
                        storeDraft,
                      }}
                    />
                  ))}
                <GroupPreviewSheet
                  group={groupPreview ?? undefined}
                  open={!!groupPreview}
                  onOpenChange={() => setGroupPreview(null)}
                  onActionComplete={handleGroupAction}
                />
              </YStack>
            </KeyboardAvoidingView>
          </FileDrop>
        </FocusedPostContext.Provider>
      </ChannelProvider>
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

  const headerTitle = isChatChannel
    ? `Thread: ${channel?.title ?? null}`
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
  clearDraft,
  editPost,
  editingPost,
  getDraft,
  goBack,
  groupMembers,
  handleGoToImage,
  headerMode,
  negotiationMatch,
  onPressDelete,
  onPressRetry,
  parentPost,
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
  getDraft: () => Promise<urbit.JSONContent | null>;
  goBack?: () => void;
  group?: db.Group | null;
  groupMembers: db.ChatMember[];
  handleGoToImage?: (post: db.Post, uri?: string) => void;
  headerMode: 'default' | 'next';
  negotiationMatch: boolean;
  onPressDelete: (post: db.Post) => void;
  onPressRetry?: (post: db.Post) => Promise<void>;
  parentPost: db.Post;
  setEditingPost?: (post: db.Post | undefined) => void;
  storeDraft: (draft: urbit.JSONContent) => Promise<void>;
}) {
  const store = useStore();
  const { focusedPost } = useContext(FocusedPostContext);
  const isFocusedPost = focusedPost?.id === parentPost.id;

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
    authorId: parentPost.id,
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
        authorId: currentUserId,
        content,
        channel: channel,
        parentId: parentPost.id,
        parentAuthor: parentPost.authorId,
      });
    },
    [currentUserId, channel, parentPost, store]
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
          headerMode={headerMode}
          editorIsFocused={false}
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
    cursor: initialPostId,
    firstPageCount: 50,
    disableUnconfirmedPosts: true,
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
