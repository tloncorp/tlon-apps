import {
  PostCollectionLayoutType,
  configurationFromChannel,
  layoutForType,
  layoutTypeFromChannel,
  useMutableCallback,
} from '@tloncorp/shared';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { isSameDay } from '@tloncorp/shared/logic';
import { isEqual } from 'lodash';
import React, {
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
  FlatList,
  LayoutChangeEvent,
  ListRenderItem,
  View as RNView,
  StyleProp,
  ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, styled, useStyle, useTheme } from 'tamagui';

import { RenderItemType } from '../../contexts/componentsKits';
import { useLivePost } from '../../contexts/requests';
import { useScrollDirectionTracker } from '../../contexts/scroll';
import useIsWindowNarrow from '../../hooks/useIsWindowNarrow';
import useOnEmojiSelect from '../../hooks/useOnEmojiSelect';
import { ChatMessageActions } from '../ChatMessage/ChatMessageActions/Component';
import { ViewReactionsSheet } from '../ChatMessage/ViewReactionsSheet';
import { EmojiPickerSheet } from '../Emoji';
import { FloatingActionButton } from '../FloatingActionButton';
import { Icon } from '../Icon';
import { LoadingSpinner } from '../LoadingSpinner';
import { Modal } from '../Modal';
import { ChannelDivider } from './ChannelDivider';

interface PostWithNeighbors {
  post: db.Post;
  newer: db.Post | null;
  older: db.Post | null;
}

const logger = createDevLogger('scroller', false);

export const INITIAL_POSTS_PER_PAGE = 30;

export type ScrollAnchor = {
  type: 'unread' | 'selected';
  postId: string;
};

/**
 * This scroller makes some assumptions you should not break!
 * - Posts and unread state should be be loaded before the scroller is rendered
 * - Posts should be sorted in descending order
 * - If we're scrolling to an anchor, that anchor should be in the first page of posts
 * - The size of the first page of posts should match `initialNumToRender` here.
 */
const Scroller = forwardRef(
  (
    {
      anchor,
      showDividers = true,
      inverted,
      renderItem,
      renderEmptyComponent: renderEmptyComponentFn,
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
      headerMode,
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
      onPressRetry: (post: db.Post) => void;
      onPressDelete: (post: db.Post) => void;
      hasNewerPosts?: boolean;
      activeMessage: db.Post | null;
      setActiveMessage: (post: db.Post | null) => void;
      ref?: RefObject<{ scrollToIndex: (params: { index: number }) => void }>;
      headerMode: 'default' | 'next';
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

    const [hasPressedGoToBottom, setHasPressedGoToBottom] = useState(false);
    const [viewReactionsPost, setViewReactionsPost] = useState<null | db.Post>(
      null
    );
    const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

    const flatListRef = useRef<FlatList<db.Post>>(null);

    useImperativeHandle(ref, () => ({
      scrollToIndex: (params: { index: number }) =>
        flatListRef.current?.scrollToIndex(params),
    }));

    const pressedGoToBottom = () => {
      setHasPressedGoToBottom(true);
      onPressScrollToBottom?.();

      // Only scroll if we're not loading and have a valid ref
      if (flatListRef.current && !isLoading) {
        // Use a small timeout to ensure state updates have processed
        requestAnimationFrame(() => {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
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

    const {
      readyToDisplayPosts,
      // setNeedsScrollToAnchor,
      // setDidAnchorSearchTimeout,
      scrollerItemProps: anchorScrollLockScrollerItemProps,
      flatlistProps: anchorScrollLockFlatlistProps,
    } = useAnchorScrollLock({
      posts,
      anchor,
      flatListRef,
      hasNewerPosts,
      shouldMaintainVisibleContentPosition:
        collectionLayout.shouldMaintainVisibleContentPosition,
      isScrollingToBottom: hasPressedGoToBottom,
    });

    const theme = useTheme();

    // Used to hide the scroller until we've found the anchor post.
    const style = useMemo(() => {
      return {
        backgroundColor: theme.background.val,
        opacity: readyToDisplayPosts ? 1 : 0,
      };
    }, [readyToDisplayPosts, theme.background.val]);

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
    const listRenderItem: ListRenderItem<PostWithNeighbors> = useCallback(
      ({ item: { post, newer: nextItem, older: previousItem }, index }) => {
        const isFirstPostOfDay = !isSameDay(
          post.receivedAt ?? 0,
          previousItem?.receivedAt ?? 0
        );
        const isLastPostOfBlock =
          post.type !== 'notice' &&
          ((nextItem && nextItem.authorId !== post.authorId) || !isSameDay);
        const showAuthor =
          post.type === 'note' ||
          post.type === 'block' ||
          previousItem?.authorId !== post.authorId ||
          previousItem?.type === 'notice' ||
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
            activeMessage={activeMessage}
            messageRef={activeMessageRefs.current[post.id]}
            dividersEnabled={collectionLayout.dividersEnabled}
            itemAspectRatio={collectionLayout.itemAspectRatio ?? undefined}
            {...anchorScrollLockScrollerItemProps}
          />
        );
      },
      [
        anchor?.type,
        anchor?.postId,
        firstUnreadId,
        renderItem,
        unreadCount,
        anchorScrollLockScrollerItemProps,
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
              paddingTop: headerMode === 'next' ? insets.top + 54 : 0,
            };
          }

          case 'grid': {
            return {
              paddingHorizontal: '$m',
              gap: '$l',
              paddingBottom: insets.bottom,
              paddingTop: headerMode === 'next' ? insets.top + 54 : 0,
            };
          }
        }
      }, [insets, posts?.length, headerMode, collectionLayoutType])
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

    const renderEmptyComponent = useCallback(() => {
      return (
        <View
          flex={1}
          paddingBottom={'$l'}
          paddingHorizontal="$l"
          alignItems="center"
          justifyContent="center"
        >
          {renderEmptyComponentFn?.()}
        </View>
      );
    }, [renderEmptyComponentFn]);

    const [isAtBottom, setIsAtBottom] = useState(true);
    const handleScroll = useScrollDirectionTracker({ setIsAtBottom });

    const scrollIndicatorInsets = useMemo(() => {
      return {
        top: 0,
        bottom: insets.bottom,
      };
    }, [insets.bottom]);

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

    const isWindowNarrow = useIsWindowNarrow();

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
        {postsWithNeighbors && (
          <Animated.FlatList<PostWithNeighbors>
            ref={flatListRef as React.RefObject<Animated.FlatList<db.Post>>}
            // This is needed so that we can force a refresh of the list when
            // we need to switch from 1 to 2 columns or vice versa.
            key={channel.type}
            data={postsWithNeighbors}
            // Disabled to prevent the user from accidentally blurring the edit
            // input while they're typing.
            scrollEnabled={!editingPost}
            renderItem={listRenderItem}
            ListEmptyComponent={renderEmptyComponent}
            keyExtractor={getPostId}
            keyboardDismissMode="on-drag"
            contentContainerStyle={contentContainerStyle}
            columnWrapperStyle={
              // FlatList raises an error if `columnWrapperStyle` is provided
              // with numColumns=1, even if the style is empty
              collectionLayout.columnCount === 1
                ? undefined
                : columnWrapperStyle
            }
            inverted={
              // https://github.com/facebook/react-native/issues/21196
              // It looks like this bug has regressed a few times - to avoid
              // our UI breaking when the bug is fixed, disable `inverted` when
              // list is empty instead of adversarily transforming the empty component.
              postsWithNeighbors.length === 0 ? false : inverted
            }
            initialNumToRender={INITIAL_POSTS_PER_PAGE}
            maxToRenderPerBatch={8}
            windowSize={8}
            numColumns={collectionLayout.columnCount}
            style={style}
            onEndReached={handleEndReached}
            onEndReachedThreshold={1}
            onStartReached={handleStartReached}
            onStartReachedThreshold={1}
            onScroll={handleScroll}
            scrollIndicatorInsets={scrollIndicatorInsets}
            automaticallyAdjustsScrollIndicatorInsets={false}
            {...anchorScrollLockFlatlistProps}
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

function getPostId({ post }: PostWithNeighbors) {
  return post.id;
}

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
  activeMessage,
  messageRef,
  isSelected,
  isLastPostOfBlock,
  dividersEnabled,
  itemAspectRatio,
}: {
  showUnreadDivider: boolean;
  showAuthor: boolean;
  showDayDivider: boolean;
  item: db.Post;
  index: number;
  Component: RenderItemType;
  unreadCount?: number | null;
  onLayout: (post: db.Post, index: number, e: LayoutChangeEvent) => void;
  onPressImage?: (post: db.Post, imageUri?: string) => void;
  onPressReplies?: (post: db.Post) => void;
  showReplies?: boolean;
  setViewReactionsPost?: (post: db.Post) => void;
  onPressPost?: (post: db.Post) => void;
  onLongPressPost: (post: db.Post) => void;
  onPressRetry: (post: db.Post) => void;
  onPressDelete: (post: db.Post) => void;
  activeMessage?: db.Post | null;
  messageRef: RefObject<RNView>;
  isSelected: boolean;
  isLastPostOfBlock: boolean;
  dividersEnabled: boolean;
  itemAspectRatio?: number;
}) => {
  const post = useLivePost(item);

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

  return (
    <View onLayout={handleLayout} flex={1} aspectRatio={itemAspectRatio}>
      {divider}
      <PressableMessage
        ref={messageRef}
        isActive={activeMessage?.id === post.id}
      >
        <Component
          isHighlighted={isSelected}
          post={post}
          setViewReactionsPost={setViewReactionsPost}
          showAuthor={showAuthor}
          showReplies={showReplies}
          onPressReplies={post.isDeleted ? undefined : onPressReplies}
          onPressImage={post.isDeleted ? undefined : onPressImage}
          onLongPress={post.isDeleted ? undefined : onLongPressPost}
          onPress={post.isDeleted ? undefined : onPressPost}
          onPressRetry={onPressRetry}
          onPressDelete={onPressDelete}
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
    prev.activeMessage === next.activeMessage;

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

/**
 * Manages locking scroll to anchor post on load.
 */
function useAnchorScrollLock({
  flatListRef,
  posts,
  anchor,
  hasNewerPosts,
  shouldMaintainVisibleContentPosition,
  isScrollingToBottom,
}: {
  flatListRef: RefObject<FlatList<db.Post>>;

  // The following should be passed directly from Channel props
  posts: db.Post[] | null;
  anchor: ScrollAnchor | null | undefined;
  hasNewerPosts?: boolean;
  shouldMaintainVisibleContentPosition: boolean;
  isScrollingToBottom: boolean;
}) {
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const [needsScrollToAnchor, setNeedsScrollToAnchor] = useState(
    () => anchor != null
  );
  const [didAnchorSearchTimeout, setDidAnchorSearchTimeout] = useState(false);
  const lastAnchorId = useRef(anchor?.postId);
  const renderedPostsRef = useRef(new Set());
  const readyToDisplayPosts = !needsScrollToAnchor || didAnchorSearchTimeout;

  const anchorIndex = useMemo(() => {
    return posts?.findIndex((p) => p.id === anchor?.postId) ?? -1;
  }, [posts, anchor]);

  // Track whether a scroll attempt is active to prevent concurrent scrolls
  const isScrollAttemptActiveRef = useRef(false);

  const scrollToAnchorIfNeeded = useCallback(async () => {
    if (didAnchorSearchTimeout) {
      return;
    }
    if (!needsScrollToAnchor) {
      logger.log('bail: !needsScrollToAnchor');
      return;
    }
    if (userHasScrolled) {
      logger.log('bail: !userHasScrolled');
      return;
    }
    if (anchorIndex === -1) {
      logger.log('bail: anchorIndex === -1');
      return;
    }
    if (flatListRef.current == null) {
      logger.log('bail: flatListRef.current == null');
      return;
    }
    if (isScrollAttemptActiveRef.current) {
      logger.log('bail: isScrollAttemptActiveRef.current');
      return;
    }

    try {
      logger.log('attempting scroll');
      isScrollAttemptActiveRef.current = true;

      setNeedsScrollToAnchor(false);

      logger.log('doing a scrollToIndex to anchor', {
        anchorIndex,
        readyToDisplayPosts,
      });

      // If we aren't showing the posts yet, we can jump without animation.
      // Once we show the posts, use an animation for the poor little user's eyesies
      const shouldAnimateScroll = readyToDisplayPosts;
      flatListRef.current.scrollToIndex({
        index: anchorIndex,
        animated: shouldAnimateScroll,
        viewPosition: anchor?.type === 'unread' ? 1 : 0.5,
      });
    } finally {
      logger.log('finished scroll attempt');
      isScrollAttemptActiveRef.current = false;
    }
  }, [
    didAnchorSearchTimeout,
    needsScrollToAnchor,
    anchorIndex,
    anchor?.type,
    userHasScrolled,
    readyToDisplayPosts,
    flatListRef,
  ]);

  const handleScrollBeginDrag = useCallback(() => {
    setUserHasScrolled(true);
  }, []);

  // We use this function to manage autoscrolling to the anchor post. We need
  // the post to be rendered before we're able to scroll to it, so we wait for
  // it here. Once it's rendered we scroll to it and set `needsScrollToAnchor` to
  // false, revealing the Scroller.
  const handleItemLayout = useMutableCallback(
    (post: db.Post, index: number) => {
      renderedPostsRef.current.add(post.id);

      if (didAnchorSearchTimeout) {
        return;
      }

      // If the anchor post got a layout, attempt a scroll.
      if (post.id === anchor?.postId) {
        logger.log('scrolling to initially set anchor', post.id, index);
        scrollToAnchorIfNeeded();
      }

      // If we've got at least a page of posts and we've rendered them all,
      // reveal the scroller to prevent getting stuck when messages are
      // deleted.
      if (posts?.length && renderedPostsRef.current.size >= posts?.length) {
        setDidAnchorSearchTimeout(true);
      }
    }
  );
  const maintainVisibleContentPositionConfig = useMemo(() => {
    if (!shouldMaintainVisibleContentPosition) {
      return undefined;
    }

    return {
      minIndexForVisible: 0,
      // If this is set to a number, the list will scroll to the bottom (or top,
      // if not inverted) when the list height changes. This is undesirable when
      // we're starting at an older post and scrolling down towards newer ones,
      // as it will trigger on every new page load, causing jumping. Instead, we
      // only enable it when there's nothing newer left to load (so, for new incoming messages only).
      autoscrollToTopThreshold: hasNewerPosts ? undefined : 0,
    };
  }, [hasNewerPosts, shouldMaintainVisibleContentPosition]);

  const handleScrollToIndexFailed = useMutableCallback(
    (info: {
      index: number;
      highestMeasuredFrameIndex: number;
      averageItemLength: number;
    }) => {
      logger.log('scroll to index failed', { info });

      // If the anchor hasn't changed then we aren't refreshing the list,
      // so we can try to scroll to the index (that we failed to scroll to)
      // again.

      if (anchor?.postId === lastAnchorId.current) {
        // The index hasn't been measured yet, so we try to guess the offset
        // based on the average item length.
        const offset = info.index * info.averageItemLength;
        logger.log('doing best guess scroll to offset', offset);
        flatListRef.current?.scrollToOffset({ offset, animated: false });

        // Scroll-to-index failure happens when the item at the target index
        // has not yet been laid out.
        // This "best guess" scroll hopes to bring the anchor post close enough
        // to viewport so that it gets rendered / laid out. By setting
        // `needsScrollToAnchor=true`, the next layout event from the anchor
        // will trigger a righteous scroll.
        setNeedsScrollToAnchor(true);
      }
    }
  );

  // `scrollToAnchorIfNeeded` has internal checks that will bail if a scroll is
  // not needed.
  // These checks double as dependencies which change the identity of
  // `scrollToAnchorIfNeeded` when it's possible a scroll is needed - that is
  // why `scrollToAnchorIfNeeded` is the sole dependency here.
  useEffect(() => {
    scrollToAnchorIfNeeded();
  }, [scrollToAnchorIfNeeded]);

  useEffect(() => {
    if (isScrollingToBottom) {
      setNeedsScrollToAnchor(false);
      setDidAnchorSearchTimeout(false);
    }
  }, [isScrollingToBottom]);

  return {
    readyToDisplayPosts,
    scrollerItemProps: useMemo(
      () =>
        ({
          onLayout: handleItemLayout,
        }) satisfies Partial<React.ComponentProps<typeof ScrollerItem>>,
      [handleItemLayout]
    ),

    flatlistProps: useMemo(
      () =>
        ({
          onScrollToIndexFailed: handleScrollToIndexFailed,
          onScrollBeginDrag: handleScrollBeginDrag,
          maintainVisibleContentPosition: maintainVisibleContentPositionConfig,
        }) satisfies Partial<
          React.ComponentProps<typeof Animated.FlatList<db.Post>>
        >,
      [
        handleScrollToIndexFailed,
        handleScrollBeginDrag,
        maintainVisibleContentPositionConfig,
      ]
    ),
  };
}
