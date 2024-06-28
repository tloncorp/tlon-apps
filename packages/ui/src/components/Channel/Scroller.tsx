import { createDevLogger } from '@tloncorp/shared/dist';
import * as db from '@tloncorp/shared/dist/db';
import { Post } from '@tloncorp/shared/dist/db';
import {
  extractContentTypesFromPost,
  isSameDay,
} from '@tloncorp/shared/dist/logic';
import { Story } from '@tloncorp/shared/dist/urbit';
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
  ListRenderItem,
  View as RNView,
  StyleProp,
  ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useStyle, useTheme } from 'tamagui';

import { useLivePost } from '../../contexts/requests';
import { useScrollDirectionTracker } from '../../contexts/scroll';
import { Modal, View, XStack } from '../../core';
import { Button } from '../Button';
import { ChatMessageActions } from '../ChatMessage/ChatMessageActions/Component';
import { Icon } from '../Icon';
import { ChannelDivider } from './ChannelDivider';

type RenderItemFunction = (props: {
  currentUserId: string;
  post: db.Post;
  showAuthor?: boolean;
  showReplies?: boolean;
  onPress?: (post: db.Post) => void;
  onPressReplies?: (post: db.Post) => void;
  onPressImage?: (post: db.Post, imageUri?: string) => void;
  onLongPress?: (post: db.Post) => void;
  editing?: boolean;
  setEditingPost?: (post: db.Post | undefined) => void;
  editPost?: (post: db.Post, content: Story) => void;
}) => ReactElement | null;

type RenderItemType =
  | RenderItemFunction
  | React.MemoExoticComponent<RenderItemFunction>;

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
 * - The size of the first page of posts should match `initialNumToRender` here.
 */
function Scroller({
  anchor,
  inverted,
  renderItem,
  renderEmptyComponent: renderEmptyComponentFn,
  posts,
  currentUserId,
  channelType,
  channelId,
  firstUnreadId,
  unreadCount,
  onStartReached,
  onEndReached,
  onPressPost,
  onPressImage,
  onPressReplies,
  onDividerSeen,
  showReplies = true,
  editingPost,
  setEditingPost,
  editPost,
  hasNewerPosts,
  hasOlderPosts,
}: {
  anchor?: ScrollAnchor | null;
  inverted: boolean;
  renderItem: RenderItemType;
  renderEmptyComponent?: () => ReactElement;
  posts: db.Post[] | null;
  currentUserId: string;
  channelType: db.ChannelType;
  channelId: string;
  firstUnreadId?: string | null;
  unreadCount?: number | null;
  onStartReached?: () => void;
  onEndReached?: () => void;
  onPressPost?: (post: db.Post) => void;
  onPressImage?: (post: db.Post, imageUri?: string) => void;
  onPressReplies?: (post: db.Post) => void;
  onDividerSeen?: (post: db.Post) => void;
  showReplies?: boolean;
  editingPost?: db.Post;
  setEditingPost?: (post: db.Post | undefined) => void;
  editPost?: (post: db.Post, content: Story) => void;
  hasNewerPosts?: boolean;
  hasOlderPosts?: boolean;
}) {
  const [isAtBottom, setIsAtBottom] = useState(true);

  const filteredPosts = useMemo(() => {
    const postsWithContent = posts?.filter((post) => {
      const { blocks, inlines, references } = extractContentTypesFromPost(post);

      if (
        blocks.length === 0 &&
        inlines.length === 0 &&
        references.length === 0 &&
        post.title === '' &&
        post.image === ''
      ) {
        return false;
      }

      return true;
    });

    if (!postsWithContent || channelType !== 'gallery') {
      return postsWithContent;
    }

    // if we're in a gallery channel and we have an uneven number of posts, we
    // need to add an empty post at the end to make sure that the last post is
    // displayed correctly

    if (postsWithContent.length % 2 !== 0) {
      const emptyPost: Post = {
        id: '',
        authorId: '~zod',
        channelId: '',
        content: JSON.stringify([{ inline: '' }]),
        receivedAt: 0,
        sentAt: 0,
        type: 'block',
        replyCount: 0,
      };

      postsWithContent.push(emptyPost);
    }

    if (!firstUnreadId) {
      return postsWithContent;
    }

    // for gallery channels we want to make sure that we separate unreads from
    // the other posts, we do that by adding an empty post after the first unread
    // post if it's at an even index
    const firstUnreadIndex = postsWithContent.findIndex(
      (post) => post.id === firstUnreadId
    );

    if (firstUnreadIndex === -1) {
      return postsWithContent;
    }

    // if first unread is at an odd index, we don't need to add an empty post
    if (firstUnreadIndex % 2 !== 0) {
      return postsWithContent;
    }

    const before = postsWithContent.slice(0, firstUnreadIndex + 1);
    const after = postsWithContent.slice(firstUnreadIndex + 1);
    const emptyPost: Post = {
      id: '',
      authorId: '~zod',
      channelId: '',
      content: JSON.stringify([{ inline: '' }]),
      receivedAt: 0,
      sentAt: 0,
      type: 'block',
      replyCount: 0,
    };

    return [...before, emptyPost, ...after];
  }, [firstUnreadId, posts, channelType]);

  const [hasPressedGoToBottom, setHasPressedGoToBottom] = useState(false);
  const flatListRef = useRef<FlatList<db.Post>>(null);

  const pressedGoToBottom = () => {
    setHasPressedGoToBottom(true);
    if (flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  };

  const [activeMessage, setActiveMessage] = useState<db.Post | null>(null);
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

  // We use this function to manage autoscrolling to the anchor post. We need
  // the post to be rendered before we're able to scroll to it, so we wait for
  // it here. Once it's rendered we scroll to it and set `hasFoundAnchor` to
  // true, revealing the Scroller.
  const handleItemLayout = useCallback(
    (post: db.Post, index: number) => {
      renderedPostsRef.current.add(post.id);
      if (anchor?.postId === post.id) {
        // This gets called every time the anchor post changes size. If the user hasn't
        // scrolled yet, we should still be locked to the anchor post, so this
        // will re-scroll on subsequent layouts as well as the first.
        if (!userHasScrolledRef.current) {
          // If we're in a gallery channel, we need to adjust the index to account
          // for the empty post we added after the first unread post.
          const galleryAdjustedIndex =
            channelType === 'gallery' && firstUnreadId !== null && index > 0
              ? index - 1
              : index;

          flatListRef.current?.scrollToIndex({
            index: galleryAdjustedIndex,
            animated: false,
            viewPosition: 1,
          });
        }
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
    [anchor, hasFoundAnchor, channelType, firstUnreadId, posts?.length]
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
      const previousItem = filteredPosts?.[index + 1];
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

      const isFirstUnread = item.id === firstUnreadId;

      if (item.id === '' && item.type === 'block') {
        return <View height={1} width="50%" backgroundColor="$background" />;
      }

      return (
        <ScrollerItem
          onDividerSeen={onDividerSeen}
          item={item}
          index={index}
          showUnreadDivider={isFirstUnread}
          showDayDivider={isFirstPostOfDay}
          showAuthor={showAuthor}
          Component={renderItem}
          currentUserId={currentUserId}
          unreadCount={unreadCount}
          editingPost={editingPost}
          onLayout={handleItemLayout}
          channelId={channelId}
          channelType={channelType}
          setEditingPost={setEditingPost}
          editPost={editPost}
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
      onDividerSeen,
      filteredPosts,
      firstUnreadId,
      renderItem,
      currentUserId,
      unreadCount,
      editingPost,
      handleItemLayout,
      channelId,
      channelType,
      setEditingPost,
      editPost,
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

  const contentContainerStyle = useStyle({
    paddingHorizontal: '$m',
    alignItems: channelType === 'gallery' ? 'center' : undefined,
  }) as StyleProp<ViewStyle>;

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
        paddingBottom={'$l'}
        paddingHorizontal="$l"
      >
        {renderEmptyComponentFn?.()}
      </View>
    );
  }, [renderEmptyComponentFn, inverted]);

  const maintainVisibleContentPositionConfig = useMemo(() => {
    return {
      minIndexForVisible: 0,
      // If this is set to a number, the list will scroll to the bottom (or top,
      // if not inverted) when the list height changes. This is undesirable when
      // we're starting at an older post and scrolling down towards newer ones,
      // as it will trigger on every new page load, causing jumping. Instead, we
      // only enable it when there's nothing newer left to load (so, for new incoming messages only).
      autoscrollToTopThreshold: hasNewerPosts ? undefined : 0,
    };
  }, [hasNewerPosts]);

  const handleScroll = useScrollDirectionTracker(setIsAtBottom);

  const scrollToBottom = useCallback(() => {
    if (flatListRef.current && isAtBottom) {
      logger.log('scrolling to bottom');
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  }, [isAtBottom]);

  // Scroll to bottom when new messages are received
  useEffect(() => {
    scrollToBottom();
  }, [filteredPosts?.length, scrollToBottom]);

  return (
    <View flex={1}>
      {/* {unreadCount && !hasPressedGoToBottom ? (
        <UnreadsButton onPress={pressedGoToBottom} />
      ) : null} */}
      {filteredPosts && (
        <Animated.FlatList<db.Post>
          ref={flatListRef}
          // This is needed so that we can force a refresh of the list when
          // we need to switch from 1 to 2 columns or vice versa.
          key={channelType}
          data={filteredPosts}
          renderItem={listRenderItem}
          ListEmptyComponent={renderEmptyComponent}
          keyExtractor={getPostId}
          keyboardDismissMode="on-drag"
          contentContainerStyle={contentContainerStyle}
          onScrollBeginDrag={handleScrollBeginDrag}
          onScrollToIndexFailed={handleScrollToIndexFailed}
          inverted={inverted}
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={10}
          maintainVisibleContentPosition={maintainVisibleContentPositionConfig}
          numColumns={channelType === 'gallery' ? 2 : 1}
          style={style}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.25}
          onStartReached={handleStartReached}
          onStartReachedThreshold={0.25}
          onScroll={handleScroll}
        />
      )}
      <Modal
        visible={activeMessage !== null}
        onDismiss={() => setActiveMessage(null)}
      >
        {activeMessage !== null && (
          <ChatMessageActions
            currentUserId={currentUserId}
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
  currentUserId,
  unreadCount,
  editingPost,
  onLayout,
  onDividerSeen,
  channelId,
  channelType,
  setEditingPost,
  editPost,
  showReplies,
  onPressImage,
  onPressReplies,
  onPressPost,
  onLongPressPost,
  activeMessage,
  messageRef,
}: {
  showUnreadDivider: boolean;
  showAuthor: boolean;
  showDayDivider: boolean;
  item: db.Post;
  index: number;
  Component: RenderItemType;
  currentUserId: string;
  unreadCount?: number | null;
  onLayout: (post: db.Post, index: number) => void;
  channelId: string;
  channelType: db.ChannelType;
  onPressImage?: (post: db.Post, imageUri?: string) => void;
  onPressReplies?: (post: db.Post) => void;
  showReplies?: boolean;
  editingPost?: db.Post;
  setEditingPost?: (post: db.Post | undefined) => void;
  editPost?: (post: db.Post, content: Story) => void;
  onPressPost?: (post: db.Post) => void;
  onLongPressPost: (post: db.Post) => void;
  onDividerSeen?: (post: db.Post) => void;
  activeMessage?: db.Post | null;
  messageRef: RefObject<RNView>;
}) => {
  const post = useLivePost(item);

  const handleLayout = useCallback(() => {
    onLayout?.(post, index);
  }, [onLayout, post, index]);

  const unreadDivider = showUnreadDivider ? (
    <ChannelDivider
      post={post}
      onSeen={onDividerSeen}
      unreadCount={unreadCount ?? 0}
      isFirstPostOfDay={showDayDivider}
      channelInfo={{ id: channelId, type: channelType }}
      index={index}
    />
  ) : null;

  const dayDivider =
    showDayDivider && !showUnreadDivider && channelType === 'chat' ? (
      <ChannelDivider
        unreadCount={0}
        post={post}
        onSeen={onDividerSeen}
        index={index}
      />
    ) : null;

  return (
    <View onLayout={handleLayout}>
      {channelType !== 'gallery' ? unreadDivider ?? dayDivider : null}
      <PressableMessage
        ref={messageRef}
        isActive={activeMessage?.id === post.id}
      >
        <Component
          currentUserId={currentUserId}
          post={post}
          editing={editingPost && editingPost?.id === item.id}
          setEditingPost={setEditingPost}
          editPost={editPost}
          showAuthor={showAuthor}
          showReplies={showReplies}
          onPressReplies={onPressReplies}
          onPressImage={onPressImage}
          onLongPress={onLongPressPost}
          onPress={onPressPost}
        />
      </PressableMessage>
      {channelType === 'gallery' ? unreadDivider : null}
    </View>
  );
};

const ScrollerItem = React.memo(BaseScrollerItem);

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
