import * as db from '@tloncorp/shared/dist/db';
import { MotiView } from 'moti';
import {
  PropsWithChildren,
  RefObject,
  createRef,
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Dimensions,
  FlatList,
  ListRenderItem,
  View as RNView,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useStyle } from 'tamagui';

import { ArrowDown } from '../../assets/icons';
import { Modal, View, XStack } from '../../core';
import { Button } from '../Button';
import ChatMessage from '../ChatMessage';
import { ChatMessageActions } from '../ChatMessage/ChatMessageActions/Component';

export default function ChatScroll({
  posts,
  currentUserId,
  channelType,
  unreadCount,
  firstUnread,
  setInputShouldBlur,
  selectedPost,
  onStartReached,
  onEndReached,
  onPressImage,
  onPressReplies,
  showReplies = true,
}: {
  posts: db.Post[];
  currentUserId: string;
  channelType: db.ChannelType;
  unreadCount?: number;
  firstUnread?: string;
  setInputShouldBlur?: (shouldBlur: boolean) => void;
  selectedPost?: string;
  onStartReached?: () => void;
  onEndReached?: () => void;
  onPressImage?: (post: db.Post, imageUri?: string) => void;
  onPressReplies?: (post: db.Post) => void;
  showReplies?: boolean;
}) {
  const [hasPressedGoToBottom, setHasPressedGoToBottom] = useState(false);
  const flatListRef = useRef<FlatList<db.Post>>(null);

  const pressedGoToBottom = () => {
    setHasPressedGoToBottom(true);
    if (flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  };

  useEffect(() => {
    if (firstUnread && flatListRef.current) {
      console.log(
        'scrolling to',
        firstUnread,
        posts.findIndex((post) => post.id === firstUnread)
      );
      flatListRef.current.scrollToIndex({
        index: posts.findIndex((post) => post.id === firstUnread),
        animated: true,
      });
    }
  }, [firstUnread, posts]);

  useEffect(() => {
    if (selectedPost && flatListRef.current) {
      const scrollToIndex = posts.findIndex((post) => post.id === selectedPost);
      if (scrollToIndex > -1) {
        flatListRef.current.scrollToIndex({
          index: scrollToIndex,
          animated: true,
        });
      }
    }
  }, [selectedPost, posts]);

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

  const renderItem: ListRenderItem<db.Post> = useCallback(
    ({ item, index }) => {
      const previousItem = posts[index + 1];
      const bySameAuthor = previousItem?.authorId === item.authorId;
      return (
        <PressableMessage
          ref={activeMessageRefs.current[item.id]}
          isActive={activeMessage?.id === item.id}
        >
          <ChatMessage
            currentUserId={currentUserId}
            post={item}
            firstUnread={firstUnread}
            unreadCount={unreadCount}
            showAuthor={!bySameAuthor}
            showReplies={showReplies}
            onPressReplies={onPressReplies}
            onPressImage={onPressImage}
            onLongPress={handlePostLongPressed}
          />
        </PressableMessage>
      );
    },
    [
      activeMessage,
      showReplies,
      firstUnread,
      onPressReplies,
      unreadCount,
      currentUserId,
      onPressImage,
      posts,
      handlePostLongPressed,
    ]
  );

  const handleScrollToIndexFailed = useCallback(
    ({ index }: { index: number }) => {
      console.log('scroll to index failed');
      const wait = new Promise((resolve) => setTimeout(resolve, 100));
      wait.then(() => {
        flatListRef.current?.scrollToIndex({
          index,
          animated: false,
        });
      });
    },
    []
  );

  const contentContainerStyle = useStyle({
    paddingHorizontal: '$m',
  }) as StyleProp<ViewStyle>;

  const handleContainerPressed = useCallback(() => {
    setInputShouldBlur?.(true);
  }, []);

  return (
    <View flex={1}>
      {unreadCount && !hasPressedGoToBottom && (
        <UnreadsButton onPress={pressedGoToBottom} />
      )}
      <FlatList<db.Post>
        ref={flatListRef}
        data={posts}
        renderItem={renderItem}
        keyExtractor={getPostId}
        keyboardDismissMode="on-drag"
        contentContainerStyle={contentContainerStyle}
        onScrollBeginDrag={handleContainerPressed}
        onScrollToIndexFailed={handleScrollToIndexFailed}
        inverted
        onEndReached={onEndReached}
        onEndReachedThreshold={2}
        onStartReached={onStartReached}
      />
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
    children
  );
});

const UnreadsButton = ({ onPress }: { onPress: () => void }) => {
  return (
    <XStack
      position="absolute"
      bottom="5%"
      left={Dimensions.get('window').width / 2 - 60}
      zIndex={50}
      width="40%"
    >
      <Button
        backgroundColor="$blueSoft"
        padding="$s"
        borderRadius="$l"
        height="$4xl"
        width="100%"
        alignItems="center"
        onPress={onPress}
        size="$s"
      >
        <Button.Text>Scroll to latest</Button.Text>
        <Button.Icon>
          <XStack width="$s" height="$s">
            <ArrowDown />
          </XStack>
        </Button.Icon>
      </Button>
    </XStack>
  );
};
