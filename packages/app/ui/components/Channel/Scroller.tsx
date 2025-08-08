import {
  PostCollectionLayoutType,
  configurationFromChannel,
  createDevLogger,
  layoutForType,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { isSameDay } from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import {
  DESKTOP_SIDEBAR_WIDTH,
  DESKTOP_TOPLEVEL_SIDEBAR_WIDTH,
  FloatingActionButton,
  Icon,
  LoadingSpinner,
  Modal,
  useIsWindowNarrow,
} from '@tloncorp/ui';
import { isEqual } from 'lodash';
import React, {
  ComponentPropsWithoutRef,
  PropsWithChildren,
  ReactElement,
  RefObject,
  createRef,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  LayoutChangeEvent,
  ListRenderItem,
  View as RNView,
  StyleProp,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, getTokens, styled, useStyle, useTheme } from 'tamagui';

import { RenderItemType } from '../../contexts/componentsKits';
import { useLivePost } from '../../contexts/requests';
import useOnEmojiSelect from '../../hooks/useOnEmojiSelect';
import { ChatMessageActions } from '../ChatMessage/ChatMessageActions/Component';
import { ViewReactionsSheet } from '../ChatMessage/ViewReactionsSheet';
import { EmojiPickerSheet } from '../Emoji';
import { ChannelDivider } from './ChannelDivider';
import { PostList, PostListMethods } from './PostList';

interface PostWithNeighbors {
  post: db.Post;
  newer: db.Post | null;
  older: db.Post | null;
}

const logger = createDevLogger('scroller', false);

export type ScrollAnchor = {
  type: 'unread' | 'selected';
  postId: string;
};

/**
 * This scroller makes some assumptions you should not break!
 * - Posts and unread state should be be loaded before the scroller is rendered
 * - Posts should be sorted in descending order
 * - If we're scrolling to an anchor, that anchor should be in the first page of posts
 */
const Scroller = forwardRef(
  (
    {
      anchor,
      showDividers = true,
      inverted,
      renderItem,
      renderEmptyComponent,
      posts,
      channel,
      collectionLayoutType,
      firstUnreadId,
      unreadCount,
      onStartReached,
      onEndReached,
      onPressPost,
      onPressImage,
      onPressReplies,
      showReplies = true,
      editingPost,
      setEditingPost,
      onPressRetry,
      onPressDelete,
      hasNewerPosts,
      activeMessage,
      setActiveMessage,
      isLoading,
      onPressScrollToBottom,
    }: {
      anchor?: ScrollAnchor | null;
      showDividers?: boolean;
      inverted: boolean;
      renderItem: RenderItemType;
      renderEmptyComponent?: () => ReactElement;
      posts: db.Post[] | null;
      channel: db.Channel;
      collectionLayoutType: PostCollectionLayoutType;
      firstUnreadId?: string | null;
      unreadCount?: number | null;
      onStartReached?: () => void;
      onEndReached?: () => void;
      onPressPost?: (post: db.Post) => void;
      onPressImage?: (post: db.Post, imageUri?: string) => void;
      onPressReplies?: (post: db.Post) => void;
      showReplies?: boolean;
      editingPost?: db.Post;
      setEditingPost?: (post: db.Post | undefined) => void;
      onPressRetry?: (post: db.Post) => Promise<void>;
      onPressDelete: (post: db.Post) => void;
      hasNewerPosts?: boolean;
      activeMessage: db.Post | null;
      setActiveMessage: (post: db.Post | null) => void;
      ref?: RefObject<{ scrollToIndex: (params: { index: number }) => void }>;
      isLoading?: boolean;
      // Unused
      hasOlderPosts?: boolean;
      onPressScrollToBottom?: () => void;
    },
    ref
  ) => {
    const collectionLayout = useMemo(
      () => layoutForType(collectionLayoutType),
      [collectionLayoutType]
    );
    const collectionConfig = useMemo(
      () => configurationFromChannel(channel),
      [channel]
    );
    const { width } = useWindowDimensions();
    const isWindowNarrow = useIsWindowNarrow();
    const availableSpace = useMemo(() => {
      const sidebarsTotalWidth = isWindowNarrow
        ? 0
        : DESKTOP_TOPLEVEL_SIDEBAR_WIDTH + DESKTOP_SIDEBAR_WIDTH;
      return Math.floor(
        width - sidebarsTotalWidth - 2 * getTokens().space.m.val
      );
    }, [width]);

    const columns = useMemo(() => {
      const gap = getTokens().space.l.val;
      return collectionLayout.columnCount === 1
        ? 1
        : Math.max(2, Math.floor((availableSpace + gap) / (250 + gap)));
    }, [availableSpace, collectionLayout.columnCount]);

    const itemWidth = useMemo(() => {
      const totalGap = (columns - 1) * getTokens().space.l.val;
      return Math.floor((availableSpace - totalGap) / columns);
    }, [availableSpace, columns]);

    const [hasPressedGoToBottom, setHasPressedGoToBottom] = useState(false);
    const [viewReactionsPost, setViewReactionsPost] = useState<null | db.Post>(
      null
    );
    const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

    const listRef = useRef<PostListMethods>(null);

    useImperativeHandle(ref, () => ({
      scrollToIndex: (params: { index: number }) =>
        listRef.current?.scrollToIndex(params),
    }));

    const pressedGoToBottom = () => {
      setHasPressedGoToBottom(true);
      onPressScrollToBottom?.();

      // Only scroll if we're not loading and have a valid ref
      if (listRef.current && !isLoading) {
        // Use a small timeout to ensure state updates have processed
        requestAnimationFrame(() => {
          listRef.current?.scrollToStart({ animated: true });
        });
      }
    };

    const activeMessageRefs = useRef<Record<string, RefObject<RNView>>>({});

    const handleSetActive = useCallback((active: db.Post) => {
      if (active.type !== 'notice') {
        activeMessageRefs.current[active.id] = createRef();
        setActiveMessage(active);
      }
    }, []);

    const handlePostLongPressed = useCallback(
      (post: db.Post) => {
        handleSetActive(post);
      },
      [handleSetActive]
    );

    const { value: debugMessageJson } = db.debugMessageJson.useStorageItem();

    const theme = useTheme();

    const postsWithNeighbors: PostWithNeighbors[] | undefined = useMemo(
      () =>
        posts?.map((post, postIndex, posts) => {
          const newerIndex = postIndex - 1;
          const olderIndex = postIndex + 1;
          const newerPost = newerIndex >= 0 ? posts[newerIndex] : null;
          const olderPost =
            olderIndex < posts.length ? posts[olderIndex] : null;
          return {
            post,
            newer: newerPost,
            older: olderPost,
          };
        }),
      [posts]
    );

    const style = useMemo(() => {
      return {
        backgroundColor: theme.background.val,
      };
    }, [theme.background.val]);

    const listRenderItem: ListRenderItem<PostWithNeighbors> = useCallback(
      ({
        item: { post, newer: nextItem, older: previousItem, ...rest },
        index,
      }) => {
        const isFirstPostOfDay = !isSameDay(
          post.receivedAt ?? 0,
          previousItem?.receivedAt ?? 0
        );
        const isLastPostOfBlock =
          post.type !== 'notice' &&
          (post.type === 'chat' || post.type === 'reply') &&
          ((nextItem && nextItem.authorId !== post.authorId) || !isSameDay);
        const showAuthor =
          post.type === 'note' ||
          post.type === 'block' ||
          !previousItem ||
          previousItem?.authorId !== post.authorId ||
          previousItem?.type === 'notice' ||
          previousItem?.isDeleted === true ||
          isFirstPostOfDay;
        const isSelected =
          anchor?.type === 'selected' && anchor.postId === post.id;

        const isFirstUnread = post.id === firstUnreadId;

        return (
          <ScrollerItem
            item={post}
            index={index}
            isSelected={isSelected}
            showUnreadDivider={showDividers && isFirstUnread}
            showDayDivider={showDividers && isFirstPostOfDay}
            showAuthor={showAuthor}
            isLastPostOfBlock={isLastPostOfBlock}
            displayDebugMode={debugMessageJson}
            Component={renderItem}
            unreadCount={unreadCount}
            setViewReactionsPost={setViewReactionsPost}
            onPressRetry={onPressRetry}
            onPressDelete={onPressDelete}
            showReplies={showReplies}
            onPressImage={onPressImage}
            onPressReplies={onPressReplies}
            onPressPost={onPressPost}
            onLongPressPost={handlePostLongPressed}
            onShowEmojiPicker={() => {
              setActiveMessage(post);
              setEmojiPickerOpen(true);
            }}
            onPressEdit={() => {
              setEditingPost?.(post);

              setActiveMessage(null);
            }}
            activeMessage={activeMessage}
            messageRef={activeMessageRefs.current[post.id]}
            dividersEnabled={collectionLayout.dividersEnabled}
            itemAspectRatio={collectionLayout.itemAspectRatio ?? undefined}
            itemWidth={itemWidth}
            columnCount={columns}
            previousPost={previousItem}
            {...rest}
          />
        );
      },
      [
        anchor?.type,
        anchor?.postId,
        firstUnreadId,
        renderItem,
        unreadCount,
        showReplies,
        onPressImage,
        onPressReplies,
        onPressPost,
        onPressDelete,
        onPressRetry,
        handlePostLongPressed,
        activeMessage,
        showDividers,
        collectionLayout.dividersEnabled,
        collectionLayout.itemAspectRatio,
        columns,
        itemWidth,
        setActiveMessage,
        setEditingPost,
        debugMessageJson,
      ]
    );

    const insets = useSafeAreaInsets();

    const contentContainerStyle = useStyle(
      useMemo(() => {
        if (!posts?.length) {
          return { flex: 1 };
        }

        switch (collectionLayoutType) {
          case 'compact-list-bottom-to-top': {
            return {
              paddingHorizontal: '$m',
            };
          }

          case 'comfy-list-top-to-bottom': {
            return {
              paddingHorizontal: '$m',
              gap: '$l',
              paddingBottom: insets.bottom,
            };
          }

          case 'grid': {
            return {
              paddingHorizontal: '$m',
              gap: '$l',
              paddingBottom: insets.bottom,
            };
          }
        }
      }, [insets, posts?.length, collectionLayoutType])
    ) as StyleProp<ViewStyle>;

    const columnWrapperStyle = useStyle(
      collectionLayout.columnCount === 1
        ? {}
        : {
            gap: '$l',
            width: '100%',
          }
    ) as StyleProp<ViewStyle>;

    const pendingEvents = useRef({
      onEndReached: false,
      onStartReached: false,
    });

    const [readyToDisplayPosts, setReadyToDisplayPosts] = useState(false);

    // We don't want to trigger onEndReached or onStartReached until we've found
    // the anchor as additional page loads during the initial render can wreak
    // havoc on layout, but if we drop the events completely they may not get
    // called again until the user scrolls, even if we need more content to fill
    // the page. Instead, we use `pendingEvents` to record the attempt, and call
    // the events after we've found the anchor.
    useEffect(() => {
      if (readyToDisplayPosts) {
        if (pendingEvents.current.onEndReached) {
          logger.log('trigger pending onEndReached');
          onEndReached?.();
          pendingEvents.current.onEndReached = false;
        }
        if (pendingEvents.current.onStartReached) {
          logger.log('trigger pending onStartReached');
          onStartReached?.();
          pendingEvents.current.onStartReached = false;
        }
      }
    }, [readyToDisplayPosts, onEndReached, onStartReached]);

    const handleEndReached = useCallback(() => {
      if (!readyToDisplayPosts) {
        pendingEvents.current.onEndReached = true;
        return;
      }
      onEndReached?.();
    }, [onEndReached, readyToDisplayPosts]);

    const handleStartReached = useCallback(() => {
      if (!readyToDisplayPosts) {
        pendingEvents.current.onStartReached = true;
        return;
      }
      onStartReached?.();
    }, [onStartReached, readyToDisplayPosts]);

    const [isAtBottom, setIsAtBottom] = useState(true);

    const shouldShowScrollButton = useCallback(() => {
      if (!isAtBottom && hasPressedGoToBottom && !isLoading && !hasNewerPosts) {
        setHasPressedGoToBottom(false);
      }

      const shouldShowForUnreads =
        collectionLayoutType === 'compact-list-bottom-to-top' &&
        unreadCount &&
        !isAtBottom;
      const shouldShowForScroll =
        collectionLayoutType === 'compact-list-bottom-to-top' &&
        !isAtBottom &&
        (!hasPressedGoToBottom || isLoading || hasNewerPosts);

      return shouldShowForUnreads || shouldShowForScroll;
    }, [
      isAtBottom,
      hasPressedGoToBottom,
      collectionLayoutType,
      unreadCount,
      isLoading,
      hasNewerPosts,
    ]);

    const onEmojiSelect = useOnEmojiSelect(activeMessage, () =>
      setEmojiPickerOpen(false)
    );

    const onScrolledToBottom = useCallback(() => {
      setIsAtBottom(true);
    }, []);
    const onScrolledAwayFromBottom = useCallback(() => {
      setIsAtBottom(false);
    }, []);
    const onInitialScrollCompleted = useCallback(() => {
      setReadyToDisplayPosts(true);
    }, []);

    return (
      <View flex={1}>
        {shouldShowScrollButton() && (
          <View position="absolute" bottom={'$m'} right={'$l'} zIndex={1000}>
            <FloatingActionButton
              icon={
                isLoading && hasPressedGoToBottom ? (
                  <LoadingSpinner size="small" />
                ) : (
                  <Icon type="ChevronDown" size="$m" />
                )
              }
              onPress={pressedGoToBottom}
            />
          </View>
        )}
        {postsWithNeighbors != null && (
          <PostList
            anchor={anchor}
            channel={channel}
            collectionLayoutType={collectionLayoutType}
            columnWrapperStyle={columnWrapperStyle}
            contentContainerStyle={contentContainerStyle}
            hasNewerPosts={hasNewerPosts}
            inverted={inverted}
            // This is needed so that we can force a refresh of the list when
            // we need to switch from 1 to 2 columns or vice versa.
            key={channel.type + '-' + columns}
            numColumns={columns}
            onEndReached={handleEndReached}
            onEndReachedThreshold={1}
            onInitialScrollCompleted={onInitialScrollCompleted}
            onScrolledAwayFromBottom={onScrolledAwayFromBottom}
            onScrolledToBottom={onScrolledToBottom}
            onScrolledToBottomThreshold={1}
            onStartReached={handleStartReached}
            onStartReachedThreshold={1}
            postsWithNeighbors={postsWithNeighbors}
            ref={listRef}
            renderEmptyComponent={renderEmptyComponent}
            renderItem={listRenderItem}
            // Disabled to prevent the user from accidentally blurring the edit
            // input while they're typing.
            scrollEnabled={!editingPost}
            style={style}
          />
        )}
        {activeMessage !== null && !emojiPickerOpen && (
          <Modal
            visible={activeMessage !== null && !emojiPickerOpen}
            onDismiss={
              isWindowNarrow ? () => setActiveMessage(null) : undefined
            }
            // We don't pass an onDismiss function on desktop because
            // a) the modal is dismissed by the actions in the
            // ChatMessageActions component.
            // b) Including it here will cause the modal to close before the
            // EmojiPickerSheet can open when the user clicks the caretdown in
            // the EmojiToolbar.
          >
            <ChatMessageActions
              post={activeMessage}
              postActionIds={collectionConfig.postActionIds}
              postRef={activeMessageRefs.current[activeMessage!.id]}
              onDismiss={() => setActiveMessage(null)}
              onReply={onPressReplies}
              onEdit={() => {
                setEditingPost?.(activeMessage);
                setActiveMessage(null);
              }}
              onShowEmojiPicker={() => {
                setEmojiPickerOpen(true);
              }}
              onViewReactions={(post) => {
                setViewReactionsPost(post);
                setActiveMessage(null);
              }}
              mode="immediate"
            />
          </Modal>
        )}
        {emojiPickerOpen && activeMessage ? (
          <EmojiPickerSheet
            open
            onOpenChange={() => {
              setActiveMessage(null);
              setEmojiPickerOpen(false);
            }}
            onEmojiSelect={onEmojiSelect}
          />
        ) : null}
        {viewReactionsPost ? (
          <ViewReactionsSheet
            post={viewReactionsPost}
            open
            onOpenChange={() => setViewReactionsPost(null)}
          />
        ) : null}
      </View>
    );
  }
);

Scroller.displayName = 'Scroller';

export default React.memo(Scroller);

// Create empty post object to avoid recreating it on every render
const EMPTY_POST: db.Post = {
  id: '',
  authorId: '',
  channelId: '',
  type: 'chat',
  receivedAt: 0,
  sentAt: 0,
  isDeleted: false,
  replyCount: 0,
};

const BaseScrollerItem = ({
  item,
  index,
  showUnreadDivider,
  showDayDivider,
  showAuthor,
  Component,
  unreadCount,
  onLayout,
  setViewReactionsPost,
  showReplies,
  onPressImage,
  onPressReplies,
  onPressPost,
  onLongPressPost,
  onPressRetry,
  onPressDelete,
  onShowEmojiPicker,
  onPressEdit,
  activeMessage,
  messageRef,
  isSelected,
  displayDebugMode,
  isLastPostOfBlock,
  dividersEnabled,
  itemAspectRatio,
  itemWidth,
  columnCount,
  previousPost,
}: {
  showUnreadDivider: boolean;
  showAuthor: boolean;
  showDayDivider: boolean;
  item: db.Post;
  index: number;
  Component: RenderItemType;
  unreadCount?: number | null;
  onLayout?: (post: db.Post, index: number, e: LayoutChangeEvent) => void;
  onPressImage?: (post: db.Post, imageUri?: string) => void;
  onPressReplies?: (post: db.Post) => void;
  showReplies?: boolean;
  setViewReactionsPost?: (post: db.Post) => void;
  onPressPost?: (post: db.Post) => void;
  onLongPressPost: (post: db.Post) => void;
  onPressRetry?: (post: db.Post) => Promise<void>;
  onPressDelete: (post: db.Post) => void;
  onShowEmojiPicker: () => void;
  onPressEdit?: () => void;
  activeMessage?: db.Post | null;
  messageRef: RefObject<RNView>;
  isSelected: boolean;
  displayDebugMode?: boolean;
  isLastPostOfBlock: boolean;
  dividersEnabled: boolean;
  itemAspectRatio?: number;
  itemWidth?: number;
  columnCount: number;
  previousPost?: db.Post | null;
}) => {
  const post = useLivePost(item);

  // Checking if the previous post exists
  const hasPreviousPost = Boolean(previousPost);
  // Get the live post for the previous post
  const livePreviousPost = useLivePost(
    // If there is a previous post, use it, otherwise use the empty post
    hasPreviousPost ? previousPost! : EMPTY_POST
  );
  // Check if the previous post (A) exists and (B) is deleted
  const isPrevDeleted = hasPreviousPost && livePreviousPost.isDeleted === true;
  // If the previous post is deleted, show the author, otherwise fall back to the
  // display rules calculated in the showAuthor prop
  const showAuthorLive = useMemo(() => {
    if (isPrevDeleted) {
      return true;
    }
    return showAuthor;
  }, [isPrevDeleted, showAuthor]);

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      onLayout?.(post, index, e);
    },
    [onLayout, post, index]
  );

  const dividerType = useMemo(() => {
    if (!dividersEnabled) {
      return null;
    }
    if (showUnreadDivider) {
      return 'unread';
    }
    if (showDayDivider) {
      return 'day';
    }
    return null;
  }, [dividersEnabled, showUnreadDivider, showDayDivider]);

  const divider = useMemo(() => {
    switch (dividerType) {
      case 'day':
        return (
          <>
            <ChannelDivider unreadCount={0} post={post} />
            <PostBlockSeparator />
          </>
        );
      case 'unread':
        return (
          <>
            <ChannelDivider
              post={post}
              unreadCount={unreadCount ?? 0}
              isFirstPostOfDay={showDayDivider}
            />
            <PostBlockSeparator />
          </>
        );
      case null:
        return null;
    }
  }, [dividerType, post, unreadCount, showDayDivider]);

  const editPost = useCallback<
    Exclude<ComponentPropsWithoutRef<RenderItemType>['editPost'], undefined>
  >(async (post, content) => {
    await store.editPost({
      post,
      content,
    });
  }, []);

  return (
    <View
      onLayout={handleLayout}
      width={columnCount === 1 ? '100%' : itemWidth}
      aspectRatio={itemAspectRatio}
    >
      {divider}
      <PressableMessage
        ref={messageRef}
        isActive={activeMessage?.id === post.id}
      >
        <Component
          editPost={editPost}
          isHighlighted={isSelected}
          displayDebugMode={displayDebugMode}
          post={post}
          setViewReactionsPost={setViewReactionsPost}
          showAuthor={showAuthorLive}
          showReplies={showReplies}
          onPressReplies={post.isDeleted ? undefined : onPressReplies}
          onPressImage={post.isDeleted ? undefined : onPressImage}
          onLongPress={post.isDeleted ? undefined : onLongPressPost}
          onPress={post.isDeleted ? undefined : onPressPost}
          onPressRetry={onPressRetry}
          onPressDelete={onPressDelete}
          onShowEmojiPicker={onShowEmojiPicker}
          onPressEdit={onPressEdit}
        />
      </PressableMessage>
      {isLastPostOfBlock && <PostBlockSeparator />}
    </View>
  );
};

export const PostBlockSeparator = styled(View, {
  name: 'PostBlockSeparator',
  height: '$m',
  width: '100%',
});

const ScrollerItem = React.memo(BaseScrollerItem, (prev, next) => {
  const isItemEqual = isEqual(prev.item, next.item);
  const isIndexEqual = prev.index === next.index;

  const areOtherPropsEqual =
    prev.showAuthor === next.showAuthor &&
    prev.showReplies === next.showReplies &&
    prev.onPressReplies === next.onPressReplies &&
    prev.onPressImage === next.onPressImage &&
    prev.onPressPost === next.onPressPost &&
    prev.onLongPressPost === next.onLongPressPost &&
    prev.activeMessage === next.activeMessage &&
    prev.itemWidth === next.itemWidth &&
    prev.displayDebugMode === next.displayDebugMode;

  return isItemEqual && areOtherPropsEqual && isIndexEqual;
});

const PressableMessage = React.memo(
  forwardRef<RNView, PropsWithChildren<{ isActive: boolean }>>(
    function PressableMessageComponent({ isActive, children }, ref) {
      return isActive ? (
        // need the extra React Native View for ref measurement
        <RNView ref={ref}>{children}</RNView>
      ) : (
        // this fragment is necessary to avoid the TS error about not being able to
        // return undefined
        <>{children}</>
      );
    }
  )
);
