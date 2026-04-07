import { ChannelContentConfiguration } from '@tloncorp/api';
import * as urbit from '@tloncorp/api/urbit';
import { JSONContent } from '@tloncorp/api/urbit';
import {
  DraftInputId,
  isChatChannel as getIsChatChannel,
  makePrettyDayAndTime,
  useDebouncedValue,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import type * as domain from '@tloncorp/shared/domain';
import * as store from '@tloncorp/shared/store';
import { Carousel, ForwardingProps } from '@tloncorp/ui';
import { KeyboardAvoidingView } from '@tloncorp/ui';
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, YStack } from 'tamagui';

import { useChannelNavigation } from '../../hooks/useChannelNavigation';
import { useIsUserActive } from '../../hooks/useUserActivity';
import { useAttachmentContext } from '../contexts/attachment';
import { useCurrentUserId } from '../contexts/appDataContext';
import { ChannelProvider } from '../contexts/channel';
import { NavigationProvider } from '../contexts/navigation';
import { useStore } from '../contexts/storeContext';
import * as utils from '../utils';
import BareChatInput from './BareChatInput';
import { BigInput } from './BigInput';
import {
  ChannelHeader,
  ChannelHeaderItemsProvider,
} from './Channel/ChannelHeader';
import { DraftInputView } from './Channel/DraftInputView';
import { ScrollAnchor } from './Channel/Scroller';
import { DetailView } from './DetailView';
import { FileDrop } from './FileDrop';
import { GroupPreviewAction, GroupPreviewSheet } from './GroupPreviewSheet';
import { DraftInputContext } from './draftInputs';
import { DraftInputContextProvider } from './draftInputs/shared';

const noop = async () => {};

const HIGHLIGHT_DURATION_MS = 5000;

interface ChatThreadHandle {
  posts: db.Post[];
  scrollToPostAtIndex: (index: number, viewPosition?: number) => void;
  highlightPost: (postId: string) => void;
}

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
  negotiationMatch: boolean;
  onPressRetry?: (post: db.Post) => Promise<void>;
  onPressDelete: (post: db.Post) => void;
  parentEditDraftCallbacks?: {
    getDraft: () => Promise<JSONContent | null>;
    storeDraft: (draft: JSONContent) => Promise<void>;
    clearDraft: () => Promise<void>;
  } | null;
}

interface GalleryDraftInputProps {
  channel: db.Channel;
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

  const draftInputContext = useMemo(
    (): DraftInputContext => ({
      configuration,
      draftInputRef: { current: null },
      editingPost,
      getDraft,
      group,
      channel,
      clearDraft,
      onPresentationModeChange: noop,
      sendPostFromDraft: async (draft) => {
        setEditingPost?.(undefined);
        await store.finalizeAndSendPost(draft);
      },
      setEditingPost,
      setShouldBlur,
      shouldBlur,
      storeDraft,
    }),
    [
      configuration,
      editingPost,
      getDraft,
      group,
      channel,
      clearDraft,
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
  onPressRetry,
  onPressDelete,
  onGroupAction,
  goToDm,
  negotiationMatch,
  selectedPostId,
}: {
  channel: db.Channel;
  parentPost: db.Post | null;
  goBack?: () => void;
  handleGoToImage?: (post: db.Post, uri?: string) => void;
  handleGoToUserProfile: (userId: string) => void;
  onGroupAction: (action: GroupPreviewAction, group: db.Group) => void;
  goToDm: (participants: string[]) => void;
  selectedPostId?: string | null;
} & ChannelContext) {
  const isWindowNarrow = utils.useIsWindowNarrow();
  const currentUserId = useCurrentUserId();
  const currentUserIsAdmin = utils.useIsAdmin(group?.id ?? '', currentUserId);
  const [groupPreview, setGroupPreview] = useState<db.Group | null>(null);

  // If this screen is showing a single post, this is equivalent to `parentPost`.
  // If this screen is a carousel, this is the currently-focused post
  // (`parentPost` does not change when swiping).
  const [focusedPost, setFocusedPost] = useState<db.Post | null>(parentPost);

  const [galleryEditShouldBlur, setGalleryEditShouldBlur] = useState(false);

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
    return editingPost != null && editingPost.id === focusedPost?.id;
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

  // Separate draft callbacks for editing the parent post (gallery/notebook).
  // This uses a different key to prevent edit drafts from leaking to
  // BareChatInput, which uses the thread key for reply drafts.
  const parentEditDraftCallbacks = store.usePostDraftCallbacks(
    focusedPost == null
      ? null
      : { draftKey: store.draftKeyFor.postEdit({ postId: focusedPost.id }) }
  );

  const { attachAssets, clearAttachments } = useAttachmentContext();

  const handleGoBack = useCallback(() => {
    // Always clear attachments when leaving thread to prevent them from
    // appearing in the main chat input
    clearAttachments();
    if (isEditingParent) {
      setEditingPost?.(undefined);
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

  const chatThreadHandleRef = useRef<ChatThreadHandle | null>(null);

  const handleRefPress = useCallback(
    (refChannel: db.Channel, post: db.Post) => {
      const threadHandle = chatThreadHandleRef.current;
      if (threadHandle) {
        const isSameChannel = refChannel.id === channel.id;
        const isSameThread =
          post.parentId === parentPost?.id || post.id === parentPost?.id;
        if (isSameChannel && isSameThread) {
          const anchorIndex = threadHandle.posts.findIndex(
            (p) => p.id === post.id
          );
          if (anchorIndex !== -1) {
            threadHandle.scrollToPostAtIndex(anchorIndex, 0.5);
            threadHandle.highlightPost(post.id);
            return;
          }
        }
      }
      navigateToRef(refChannel, post);
    },
    [navigateToRef, channel.id, parentPost?.id]
  );

  return (
    <NavigationProvider
      onGoToUserProfile={handleGoToUserProfile}
      onPressRef={handleRefPress}
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
                    (isEditingParent && channel.type === 'gallery' ? (
                      <YStack flex={1} backgroundColor="$background">
                        <GalleryDraftInput
                          channel={channel}
                          editingPost={editingPost}
                          getDraft={
                            parentEditDraftCallbacks?.getDraft ??
                            (async () => null)
                          }
                          group={group}
                          clearDraft={
                            parentEditDraftCallbacks?.clearDraft ??
                            (async () => {})
                          }
                          setEditingPost={setEditingPost}
                          setShouldBlur={setGalleryEditShouldBlur}
                          shouldBlur={galleryEditShouldBlur}
                          storeDraft={
                            parentEditDraftCallbacks?.storeDraft ??
                            (async () => {})
                          }
                        />
                      </YStack>
                    ) : mode === 'single' ? (
                      <SinglePostView
                        {...{
                          channel,
                          chatThreadHandleRef,
                          editingPost,
                          goBack,
                          group,
                          handleGoToImage,
                          negotiationMatch,
                          onPressDelete,
                          onPressRetry,
                          parentEditDraftCallbacks,
                          parentPost,
                          selectedPostId,
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
                          editingPost,
                          group,
                          negotiationMatch,
                          onPressDelete,
                          onPressRetry,
                          parentEditDraftCallbacks,
                          setEditingPost,
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
  'channel' | 'group' | 'title' | 'description' | 'showSearchButton' | 'post'
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
      description={''}
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
  chatThreadHandleRef,
  group,
  editingPost,
  goBack,
  handleGoToImage,
  negotiationMatch,
  onPressDelete,
  onPressRetry,
  parentEditDraftCallbacks,
  parentPost,
  selectedPostId,
  setEditingPost,
}: {
  channel: db.Channel;
  chatThreadHandleRef?: React.MutableRefObject<ChatThreadHandle | null>;
  editingPost?: db.Post;
  goBack?: () => void;
  group: db.Group | null;
  handleGoToImage?: (post: db.Post, uri?: string) => void;
  negotiationMatch: boolean;
  onPressDelete: (post: db.Post) => void;
  onPressRetry?: (post: db.Post) => Promise<void>;
  parentEditDraftCallbacks?: {
    getDraft: () => Promise<JSONContent | null>;
    storeDraft: (draft: JSONContent) => Promise<void>;
    clearDraft: () => Promise<void>;
  } | null;
  parentPost: db.Post;
  selectedPostId?: string | null;
  setEditingPost?: (post: db.Post | undefined) => void;
}) {
  const groupMembers = group?.members ?? [];
  const groupRoles = group?.roles ?? [];
  const store = useStore();
  const { focusedPost } = useContext(FocusedPostContext);
  const isFocusedPost = focusedPost?.id === parentPost.id;
  const isUserActive = useIsUserActive();

  const scrollerRef = useRef<{
    scrollToStart: (opts: { animated?: boolean }) => void;
    scrollToEnd: (opts: { animated?: boolean }) => void;
    scrollToIndex: (params: {
      index: number;
      animated?: boolean;
      viewPosition?: number;
    }) => void;
  }>(null);

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

  // --- Chat-thread highlight + fast-path handle ---
  const [highlightPostId, setHighlightPostId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const highlightPost = useCallback((postId: string) => {
    setHighlightPostId(postId);
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightPostId(null);
    }, HIGHLIGHT_DURATION_MS);
  }, []);

  // Keep chatThreadHandleRef in sync (chat threads only).
  // useLayoutEffect ensures the ref is populated before paint so
  // handleRefPress can read it synchronously during the same frame.
  useLayoutEffect(() => {
    if (!chatThreadHandleRef) return;

    if (isChatChannel && posts) {
      chatThreadHandleRef.current = {
        posts,
        scrollToPostAtIndex: (index: number, viewPosition?: number) => {
          scrollerRef.current?.scrollToIndex({
            index,
            animated: true,
            viewPosition,
          });
        },
        highlightPost,
      };
    } else {
      chatThreadHandleRef.current = null;
    }

    return () => {
      chatThreadHandleRef.current = null;
    };
  }, [chatThreadHandleRef, isChatChannel, posts, highlightPost]);

  // Clear pending highlight timer on unmount.
  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  // Compute a ScrollAnchor from selectedPostId for chat threads.
  // This wires into useAnchorScrollLock via Scroller, giving us retry/recovery
  // for unmeasured items instead of a one-shot scrollToIndex.
  const threadAnchor: ScrollAnchor | null = useMemo(() => {
    if (isChatChannel && selectedPostId) {
      return { type: 'selected', postId: selectedPostId };
    }
    return null;
  }, [isChatChannel, selectedPostId]);

  // Trigger the 5s temporary highlight when selectedPostId changes.
  // Scrolling is handled by the anchor via useAnchorScrollLock.
  useEffect(() => {
    if (isChatChannel && selectedPostId) {
      highlightPost(selectedPostId);
    }
  }, [isChatChannel, selectedPostId, highlightPost]);

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
  const scrollToNewReply = useCallback(() => {
    requestAnimationFrame(() => {
      if (isChatChannel) {
        scrollerRef.current?.scrollToStart({ animated: true });
      } else {
        scrollerRef.current?.scrollToEnd({ animated: true });
      }
    });
  }, [isChatChannel]);

  const hasLoadedReplies = !!(posts && channel && parentPost);
  // Only mark thread as read when user is actively using the app (not idle)
  useMarkThreadAsReadEffect(
    channel == null || parentPost == null || threadPosts?.[0] == null
      ? null
      : {
          channel,
          mostRecentlyReceivedReply: threadPosts[0],
          parent: parentPost,
          shouldMarkRead: isFocusedPost && hasLoadedReplies && isUserActive,
        }
  );

  const sendReplyFromDraft = useCallback(
    async (draft: domain.PostDataDraft) => {
      setEditingPost?.(undefined);
      draft.replyToPostId = parentPost.id;
      await store.finalizeAndSendPost(draft);
      scrollToNewReply();
    },
    [parentPost, store, scrollToNewReply, setEditingPost]
  );

  const isChatLike = useMemo(
    () =>
      channel.type === 'chat' ||
      channel.type === 'dm' ||
      channel.type === 'groupDm',
    [channel.type]
  );

  const replyDraftInputContext = useMemo(
    (): DraftInputContext => ({
      channel,
      clearDraft,
      editingPost,
      getDraft,
      group,
      sendPostFromDraft: sendReplyFromDraft,
      setEditingPost,
      setShouldBlur: setInputShouldBlur,
      shouldBlur: inputShouldBlur,
      storeDraft,
      replyToPost: { id: parentPost.id },
    }),
    [
      channel,
      clearDraft,
      editingPost,
      getDraft,
      group,
      sendReplyFromDraft,
      setEditingPost,
      inputShouldBlur,
      storeDraft,
      parentPost.id,
    ]
  );

  return (
    <YStack flex={1}>
      {parentPost ? (
        <DetailView
          post={parentPost}
          channel={channel}
          initialPostUnread={initialThreadUnread}
          anchor={threadAnchor}
          onPressImage={handleGoToImage}
          editingPost={editingPost}
          setEditingPost={setEditingPost}
          onPressRetry={onPressRetry}
          onPressDelete={onPressDelete}
          posts={postsWithoutParent}
          goBack={goBack}
          activeMessage={activeMessage}
          setActiveMessage={setActiveMessage}
          highlightPostId={highlightPostId}
          scrollerRef={scrollerRef}
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
            <DraftInputContextProvider value={replyDraftInputContext}>
              <BareChatInput
                {...replyDraftInputContext}
                placeholder="Reply"
                channelId={replyDraftInputContext.channel.id}
                groupId={replyDraftInputContext.channel.groupId}
                groupMembers={groupMembers}
                groupRoles={groupRoles}
                channelType="chat"
                showAttachmentButton={isChatLike}
                showInlineAttachments
                shouldAutoFocus={
                  (isChatLike && parentPost?.replyCount === 0) || !!editingPost
                }
              />
            </DraftInputContextProvider>
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

      {/* Notebook editing handled here; gallery editing is at PostScreenView level */}
      {parentPost && isEditingParent && channel.type === 'notebook' ? (
        <View
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          backgroundColor="$background"
        >
          <BigInput
            channelType={urbit.getChannelType(parentPost.channelId)}
            channelId={parentPost?.channelId}
            editingPost={editingPost}
            setEditingPost={setEditingPost}
            shouldBlur={inputShouldBlur}
            setShouldBlur={setInputShouldBlur}
            sendPostFromDraft={async (draft) => {
              setEditingPost?.(undefined);
              await store.finalizeAndSendPost(draft);
            }}
            getDraft={parentEditDraftCallbacks?.getDraft ?? (async () => null)}
            storeDraft={
              parentEditDraftCallbacks?.storeDraft ?? (async () => {})
            }
            clearDraft={
              parentEditDraftCallbacks?.clearDraft ?? (async () => {})
            }
            groupMembers={groupMembers}
            groupRoles={groupRoles}
          />
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
