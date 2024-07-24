import { createDevLogger } from '@tloncorp/shared/dist';
import * as db from '@tloncorp/shared/dist/db';
import { isSameDay } from '@tloncorp/shared/dist/logic';
import { Story } from '@tloncorp/shared/dist/urbit';
import { isEqual } from 'lodash';
import { MotiView } from 'moti';
import React, {
  PropsWithChildren,
  ReactElement,
  RefObject,
  createRef,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FlatList,
  LayoutChangeEvent,
  ListRenderItem,
  Platform,
  View as RNView,
  StyleProp,
  ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStyle, useTheme } from 'tamagui';

import { useLivePost } from '../../contexts/requests';
import { useScrollDirectionTracker } from '../../contexts/scroll';
import { Modal, View, XStack } from '../../core';
import { Button } from '../Button';
import { ChatMessageActions } from '../ChatMessage/ChatMessageActions/Component';
import { Icon } from '../Icon';
import { ChannelDivider } from './ChannelDivider';

type RenderItemFunction = (props: {
  post: db.Post;
  showAuthor?: boolean;
  showReplies?: boolean;
  onPress?: (post: db.Post) => void;
  onPressReplies?: (post: db.Post) => void;
  onPressImage?: (post: db.Post, imageUri?: string) => void;
  onLongPress?: (post: db.Post) => void;
  editing?: boolean;
  setEditingPost?: (post: db.Post | undefined) => void;
  editPost?: (post: db.Post, content: Story) => Promise<void>;
  onPressRetry: (post: db.Post) => void;
  onPressDelete: (post: db.Post) => void;
  isHighlighted?: boolean;
}) => ReactElement | null;

type RenderItemType =
  | RenderItemFunction
  | React.MemoExoticComponent<RenderItemFunction>;

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
function Scroller({
  anchor,
  inverted,
  renderItem,
  renderEmptyComponent: renderEmptyComponentFn,
  posts,
  channelType,
  channelId,
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
  editPost,
  onPressRetry,
  onPressDelete,
  hasNewerPosts,
  hasOlderPosts,
  activeMessage,
  setActiveMessage,
}: {
  anchor?: ScrollAnchor | null;
  inverted: boolean;
  renderItem: RenderItemType;
  renderEmptyComponent?: () => ReactElement;
  posts: db.Post[] | null;
  channelType: db.ChannelType;
  channelId: string;
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
  editPost?: (post: db.Post, content: Story) => Promise<void>;
  onPressRetry: (post: db.Post) => void;
  onPressDelete: (post: db.Post) => void;
  hasNewerPosts?: boolean;
  hasOlderPosts?: boolean;
  activeMessage: db.Post | null;
  setActiveMessage: (post: db.Post | null) => void;
}) {
  const [isAtBottom, setIsAtBottom] = useState(true);

  const [hasPressedGoToBottom, setHasPressedGoToBottom] = useState(false);
  const flatListRef = useRef<FlatList<db.Post>>(null);

  const pressedGoToBottom = () => {
    setHasPressedGoToBottom(true);
    if (flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
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

  const userHasScrolledRef = useRef(false);
  const renderedPostsRef = useRef(new Set());
  // Whether we've scrolled to the anchor post.
  const [hasFoundAnchor, setHasFoundAnchor] = useState(!anchor);
  const anchorIndex = useMemo(() => {
    return posts?.findIndex((p) => p.id === anchor?.postId) ?? -1;
  }, [posts, anchor]);

  // We use this function to manage autoscrolling to the anchor post. We need
  // the post to be rendered before we're able to scroll to it, so we wait for
  // it here. Once it's rendered we scroll to it and set `hasFoundAnchor` to
  // true, revealing the Scroller.
  const handleItemLayout = useCallback(
    (post: db.Post, index: number) => {
      renderedPostsRef.current.add(post.id);
      if (
        !userHasScrolledRef.current &&
        (post.id === anchor?.postId || (hasFoundAnchor && anchorIndex !== -1))
      ) {
        flatListRef.current?.scrollToIndex({
          index: anchorIndex,
          animated: false,
          viewPosition: anchor?.type === 'unread' ? 1 : 0.5,
        });
      }
      if (
        !hasFoundAnchor &&
        (anchor?.postId === post.id ||
          // if we've got at least a page of posts and we've rendered them all,
          // reveal the scroller to prevent getting stuck when messages are
          // deleted.
          (posts?.length && renderedPostsRef.current.size >= posts?.length))
      ) {
        setHasFoundAnchor(true);
      }
    },
    [anchor?.postId, anchorIndex, hasFoundAnchor, posts?.length]
  );

  const theme = useTheme();

  // Used to hide the scroller until we've found the anchor post.
  const style = useMemo(() => {
    return {
      opacity: hasFoundAnchor ? 1 : 0,
      backgroundColor: theme.background.val,
    };
  }, [hasFoundAnchor, theme.background.val]);

  const listRenderItem: ListRenderItem<db.Post> = useCallback(
    ({ item, index }) => {
      const previousItem = posts?.[index + 1];
      const isFirstPostOfDay = !isSameDay(
        item.receivedAt ?? 0,
        previousItem?.receivedAt ?? 0
      );
      const showAuthor =
        item.type === 'note' ||
        item.type === 'block' ||
        previousItem?.authorId !== item.authorId ||
        previousItem?.type === 'notice' ||
        isFirstPostOfDay;
      const isSelected =
        anchor?.type === 'selected' && item.id === anchor.postId;

      const isFirstUnread = item.id === firstUnreadId;

      return (
        <ScrollerItem
          item={item}
          index={index}
          isSelected={isSelected}
          showUnreadDivider={isFirstUnread}
          showDayDivider={isFirstPostOfDay}
          showAuthor={showAuthor}
          Component={renderItem}
          unreadCount={unreadCount}
          editingPost={editingPost}
          onLayout={handleItemLayout}
          channelId={channelId}
          channelType={channelType}
          setEditingPost={setEditingPost}
          editPost={editPost}
          onPressRetry={onPressRetry}
          onPressDelete={onPressDelete}
          showReplies={showReplies}
          onPressImage={onPressImage}
          onPressReplies={onPressReplies}
          onPressPost={onPressPost}
          onLongPressPost={handlePostLongPressed}
          activeMessage={activeMessage}
          messageRef={activeMessageRefs.current[item.id]}
        />
      );
    },
    [
      posts,
      anchor,
      firstUnreadId,
      renderItem,
      unreadCount,
      editingPost,
      handleItemLayout,
      channelId,
      channelType,
      setEditingPost,
      editPost,
      onPressRetry,
      onPressDelete,
      showReplies,
      onPressImage,
      onPressReplies,
      onPressPost,
      handlePostLongPressed,
      activeMessage,
    ]
  );

  const handleScrollToIndexFailed = useCallback(() => {
    console.log('scroll to index failed');
  }, []);

  const insets = useSafeAreaInsets();

  const contentContainerStyle = useStyle(
    !posts?.length
      ? { flex: 1 }
      : channelType === 'gallery'
        ? {
            paddingHorizontal: '$l',
            paddingBottom: insets.bottom,
            gap: '$l',
          }
        : channelType === 'notebook'
          ? {
              paddingHorizontal: '$xl',
              gap: '$xl',
            }
          : {
              paddingHorizontal: '$m',
            }
  ) as StyleProp<ViewStyle>;

  const columnWrapperStyle = useStyle(
    channelType === 'gallery'
      ? {
          gap: '$l',
          width: '100%',
        }
      : {}
  ) as StyleProp<ViewStyle>;

  const handleScrollBeginDrag = useCallback(() => {
    userHasScrolledRef.current = true;
  }, []);

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
    if (hasFoundAnchor) {
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
  }, [hasFoundAnchor, onEndReached, onStartReached]);

  const handleEndReached = useCallback(() => {
    if (!hasFoundAnchor) {
      pendingEvents.current.onEndReached = true;
      return;
    }
    onEndReached?.();
  }, [onEndReached, hasFoundAnchor]);

  const handleStartReached = useCallback(() => {
    if (!hasFoundAnchor) {
      pendingEvents.current.onStartReached = true;
      return;
    }
    onStartReached?.();
  }, [onStartReached, hasFoundAnchor]);

  const renderEmptyComponent = useCallback(() => {
    return (
      <View
        flex={1}
        // Flatlist doesn't handle inverting this component, so we do it manually.
        scaleY={inverted ? -1 : 1}
        rotateY={inverted && Platform.OS === 'android' ? '180deg' : undefined}
        paddingBottom={'$l'}
        paddingHorizontal="$l"
        alignItems="center"
        justifyContent="center"
      >
        {renderEmptyComponentFn?.()}
      </View>
    );
  }, [renderEmptyComponentFn, inverted]);

  const maintainVisibleContentPositionConfig = useMemo(() => {
    return channelType === 'chat' ||
      channelType === 'dm' ||
      channelType === 'groupDm'
      ? {
          minIndexForVisible: 0,
          // If this is set to a number, the list will scroll to the bottom (or top,
          // if not inverted) when the list height changes. This is undesirable when
          // we're starting at an older post and scrolling down towards newer ones,
          // as it will trigger on every new page load, causing jumping. Instead, we
          // only enable it when there's nothing newer left to load (so, for new incoming messages only).
          autoscrollToTopThreshold: hasNewerPosts ? undefined : 0,
        }
      : undefined;
  }, [hasNewerPosts, channelType]);

  const handleScroll = useScrollDirectionTracker(setIsAtBottom);

  const scrollIndicatorInsets = useMemo(() => {
    return {
      top: 0,
      bottom: insets.bottom,
    };
  }, [insets.bottom]);

  return (
    <View flex={1}>
      {/* {unreadCount && !hasPressedGoToBottom ? (
        <UnreadsButton onPress={pressedGoToBottom} />
      ) : null} */}
      {posts && (
        <Animated.FlatList<db.Post>
          ref={flatListRef}
          // This is needed so that we can force a refresh of the list when
          // we need to switch from 1 to 2 columns or vice versa.
          key={channelType}
          data={posts}
          renderItem={listRenderItem}
          ListEmptyComponent={renderEmptyComponent}
          keyExtractor={getPostId}
          keyboardDismissMode="on-drag"
          contentContainerStyle={contentContainerStyle}
          columnWrapperStyle={channelType === 'gallery' && columnWrapperStyle}
          onScrollBeginDrag={handleScrollBeginDrag}
          onScrollToIndexFailed={handleScrollToIndexFailed}
          inverted={inverted}
          initialNumToRender={INITIAL_POSTS_PER_PAGE}
          maxToRenderPerBatch={8}
          windowSize={8}
          maintainVisibleContentPosition={maintainVisibleContentPositionConfig}
          numColumns={channelType === 'gallery' ? 2 : 1}
          style={style}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          onStartReached={handleStartReached}
          onStartReachedThreshold={0.1}
          onScroll={handleScroll}
          scrollIndicatorInsets={scrollIndicatorInsets}
          automaticallyAdjustsScrollIndicatorInsets={false}
        />
      )}
      <Modal
        visible={activeMessage !== null}
        onDismiss={() => setActiveMessage(null)}
      >
        {activeMessage !== null && (
          <ChatMessageActions
            post={activeMessage}
            postRef={activeMessageRefs.current[activeMessage!.id]}
            onDismiss={() => setActiveMessage(null)}
            channelType={channelType}
            onReply={onPressReplies}
            onEdit={() => {
              setEditingPost?.(activeMessage);
              setActiveMessage(null);
            }}
          />
        )}
      </Modal>
    </View>
  );
}

export default React.memo(Scroller);

function getPostId(post: db.Post) {
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
  editingPost,
  onLayout,
  channelId,
  channelType,
  setEditingPost,
  editPost,
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
}: {
  showUnreadDivider: boolean;
  showAuthor: boolean;
  showDayDivider: boolean;
  item: db.Post;
  index: number;
  Component: RenderItemType;
  unreadCount?: number | null;
  onLayout: (post: db.Post, index: number, e: LayoutChangeEvent) => void;
  channelId: string;
  channelType: db.ChannelType;
  onPressImage?: (post: db.Post, imageUri?: string) => void;
  onPressReplies?: (post: db.Post) => void;
  showReplies?: boolean;
  editingPost?: db.Post;
  setEditingPost?: (post: db.Post | undefined) => void;
  editPost?: (post: db.Post, content: Story) => Promise<void>;
  onPressPost?: (post: db.Post) => void;
  onLongPressPost: (post: db.Post) => void;
  onPressRetry: (post: db.Post) => void;
  onPressDelete: (post: db.Post) => void;
  activeMessage?: db.Post | null;
  messageRef: RefObject<RNView>;
  isSelected: boolean;
}) => {
  const post = useLivePost(item);

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      onLayout?.(post, index, e);
    },
    [onLayout, post, index]
  );

  const unreadDivider = showUnreadDivider ? (
    <ChannelDivider
      post={post}
      unreadCount={unreadCount ?? 0}
      isFirstPostOfDay={showDayDivider}
      channelInfo={{ id: channelId, type: channelType }}
      index={index}
    />
  ) : null;

  const dayDivider =
    showDayDivider && !showUnreadDivider && channelType === 'chat' ? (
      <ChannelDivider unreadCount={0} post={post} index={index} />
    ) : null;

  return (
    <View
      onLayout={handleLayout}
      {...(channelType === 'gallery' ? { aspectRatio: 1, flex: 0.5 } : {})}
    >
      {channelType === 'chat' ||
      channelType === 'dm' ||
      channelType === 'groupDm'
        ? unreadDivider ?? dayDivider
        : null}
      <PressableMessage
        ref={messageRef}
        isActive={activeMessage?.id === post.id}
      >
        <Component
          isHighlighted={isSelected}
          post={post}
          editing={editingPost && editingPost?.id === item.id}
          setEditingPost={setEditingPost}
          editPost={editPost}
          showAuthor={showAuthor}
          showReplies={showReplies}
          onPressReplies={post.isDeleted ? () => {} : onPressReplies}
          onPressImage={post.isDeleted ? () => {} : onPressImage}
          onLongPress={post.isDeleted ? () => {} : onLongPressPost}
          onPress={post.isDeleted ? () => {} : onPressPost}
          onPressRetry={onPressRetry}
          onPressDelete={onPressDelete}
        />
      </PressableMessage>
    </View>
  );
};

const ScrollerItem = React.memo(BaseScrollerItem, (prev, next) => {
  const isItemEqual = isEqual(prev.item, next.item);
  const isIndexEqual = prev.index === next.index;

  const areOtherPropsEqual =
    prev.showAuthor === next.showAuthor &&
    prev.showReplies === next.showReplies &&
    prev.editingPost === next.editingPost &&
    prev.editPost === next.editPost &&
    prev.setEditingPost === next.setEditingPost &&
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
        <MotiView
          animate={{
            scale: 0.95,
          }}
          transition={{
            scale: {
              type: 'timing',
              duration: 50,
            },
          }}
        >
          <RNView ref={ref}>{children}</RNView>
        </MotiView>
      ) : (
        // this fragment is necessary to avoid the TS error about not being able to
        // return undefined
        <>{children}</>
      );
    }
  )
);

const UnreadsButton = ({ onPress }: { onPress: () => void }) => {
  return (
    <XStack position="absolute" zIndex={50} bottom="5%" width="40%" left="30%">
      <Button
        backgroundColor="$positiveBackground"
        paddingVertical="$s"
        paddingHorizontal="$m"
        borderRadius="$l"
        width="100%"
        alignItems="center"
        justifyContent="center"
        gap="$s"
        onPress={onPress}
        size="$s"
      >
        <Button.Text color="$positiveActionText">Scroll to latest</Button.Text>
        <Icon
          type="ArrowDown"
          color="$positiveActionText"
          width="$s"
          height="$s"
          size="$l"
        />
      </Button>
    </XStack>
  );
};
