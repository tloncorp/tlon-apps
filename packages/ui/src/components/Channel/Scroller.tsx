import * as db from '@tloncorp/shared/dist/db';
import { isSameDay } from '@tloncorp/shared/dist/logic';
import { Story } from '@tloncorp/shared/dist/urbit';
import { MotiView } from 'moti';
import React, {
  PropsWithChildren,
  ReactElement,
  RefObject,
  createRef,
  forwardRef,
  useCallback,
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
import { useStyle } from 'tamagui';

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

export type ScrollAnchor = {
  type: 'unread' | 'selected';
  postId: string;
};

const maintainVisibleContentPositionConfig = {
  minIndexForVisible: 0,
};

/**
 * This scroller makes some assumptions you should not break!
 * - Posts and unread state should be be loaded before the scroller is rendered
 * - Posts should be sorted in descending order
 * - If we're scrolling to an anchor, that anchor should be in the first page of posts
 * - The size of the first page of posts should match `initialNumToRender` here.
 */
export default function Scroller({
  anchor,
  inverted,
  renderItem,
  renderEmptyComponent,
  posts,
  currentUserId,
  channelType,
  channelId,
  firstUnreadId,
  unreadCount,
  setInputShouldBlur,
  onStartReached,
  onEndReached,
  onPressImage,
  onPressReplies,
  showReplies = true,
  editingPost,
  setEditingPost,
  editPost,
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
  setInputShouldBlur?: (shouldBlur: boolean) => void;
  onStartReached?: () => void;
  onEndReached?: () => void;
  onPressImage?: (post: db.Post, imageUri?: string) => void;
  onPressReplies?: (post: db.Post) => void;
  showReplies?: boolean;
  editingPost?: db.Post;
  setEditingPost?: (post: db.Post | undefined) => void;
  editPost?: (post: db.Post, content: Story) => void;
}) {
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
  const [hasFoundAnchor, setHasFoundAnchor] = useState(!anchor);

  const handleItemLayout = useCallback(
    (post: db.Post, index: number) => {
      if (anchor?.postId === post.id) {
        if (!hasFoundAnchor) {
          setHasFoundAnchor(true);
        }
        if (!userHasScrolledRef.current) {
          flatListRef.current?.scrollToIndex({
            index,
            animated: false,
            viewPosition: 1,
          });
        }
      }
    },
    [anchor, hasFoundAnchor]
  );

  const listRenderItem: ListRenderItem<db.Post> = useCallback(
    ({ item, index }) => {
      const previousItem = posts?.[index + 1];
      const isFirstPostOfDay = !isSameDay(
        item.receivedAt ?? 0,
        previousItem?.receivedAt ?? 0
      );
      const showAuthor =
        previousItem?.authorId !== item.authorId ||
        previousItem?.type === 'notice' ||
        (item.replyCount ?? 0) > 0 ||
        isFirstPostOfDay;
      const isFirstUnread = item.id === firstUnreadId;
      // this is necessary because we can't call memoized components as functions
      // (they are objects, not functions)
      const RenderItem = renderItem;
      return (
        <View onLayout={(e) => handleItemLayout(item, index)}>
          {isFirstUnread ? (
            <ChannelDivider
              timestamp={item.receivedAt}
              unreadCount={unreadCount ?? 0}
              isFirstPostOfDay={isFirstPostOfDay}
              channelInfo={{ id: channelId, type: channelType }}
            />
          ) : isFirstPostOfDay && item.type === 'chat' ? (
            <ChannelDivider unreadCount={0} timestamp={item.receivedAt} />
          ) : null}
          <PressableMessage
            ref={activeMessageRefs.current[item.id]}
            isActive={activeMessage?.id === item.id}
          >
            <RenderItem
              currentUserId={currentUserId}
              post={item}
              editing={editingPost && editingPost?.id === item.id}
              setEditingPost={setEditingPost}
              editPost={editPost}
              showAuthor={showAuthor}
              showReplies={showReplies}
              onPressReplies={onPressReplies}
              onPressImage={onPressImage}
              onLongPress={() => handlePostLongPressed(item)}
            />
          </PressableMessage>
        </View>
      );
    },
    [
      posts,
      unreadCount,
      firstUnreadId,
      handleItemLayout,
      renderItem,
      channelId,
      channelType,
      activeMessage?.id,
      currentUserId,
      showReplies,
      onPressReplies,
      onPressImage,
      handlePostLongPressed,
      editingPost,
      setEditingPost,
      editPost,
    ]
  );

  const handleScrollToIndexFailed = useCallback(() => {
    console.log('scroll to index failed');
  }, []);

  const contentContainerStyle = useStyle({
    paddingHorizontal: '$m',
  }) as StyleProp<ViewStyle>;

  const handleContainerPressed = useCallback(() => {
    setInputShouldBlur?.(true);
  }, []);

  const handleEndReached = useCallback(() => {
    if (!hasFoundAnchor) {
      return;
    }
    onEndReached?.();
  }, [onEndReached, hasFoundAnchor]);

  const handleStartReached = useCallback(() => {
    if (!hasFoundAnchor) {
      return;
    }
    onStartReached?.();
  }, [onStartReached, hasFoundAnchor]);

  const handlePointerMove = useCallback(() => {
    userHasScrolledRef.current = true;
  }, []);

  const style = useMemo(() => {
    return {
      opacity: hasFoundAnchor ? 1 : 0,
      backgroundColor: 'white',
    };
  }, [hasFoundAnchor]);

  return (
    <View flex={1}>
      {/* {unreadCount && !hasPressedGoToBottom ? (
  <UnreadsButton onPress={pressedGoToBottom} />
) : null} */}

      {posts && (
        <FlatList<db.Post>
          onPointerMove={handlePointerMove}
          ref={flatListRef}
          data={posts}
          renderItem={listRenderItem}
          ListEmptyComponent={renderEmptyComponent}
          keyExtractor={getPostId}
          keyboardDismissMode="on-drag"
          contentContainerStyle={contentContainerStyle}
          onScrollBeginDrag={handleContainerPressed}
          onScrollToIndexFailed={handleScrollToIndexFailed}
          inverted={inverted}
          initialNumToRender={10}
          maintainVisibleContentPosition={maintainVisibleContentPositionConfig}
          style={style}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          onStartReached={handleStartReached}
          onStartReachedThreshold={0.5}
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

function getPostId(post: db.Post) {
  return post.id;
}

const PressableMessage = forwardRef<
  RNView,
  PropsWithChildren<{ isActive: boolean }>
>(function PressableMessageComponent({ isActive, children }, ref) {
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
});

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
