import * as db from '@tloncorp/shared/dist/db';
import { MotiView } from 'moti';
import {
  PropsWithChildren,
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
  Dimensions,
  FlatList,
  ListRenderItem,
  Pressable,
  View as RNView,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useStyle } from 'tamagui';

import { ArrowDown } from '../../assets/icons';
import { Modal, View, XStack } from '../../core';
import { Button } from '../Button';
import ChatMessage from '../ChatMessage';
import { ChatMessageActions } from '../ChatMessage/ChatMessageActions';

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
  onPressReplies,
  showReplies = true,
}: {
  posts: db.PostWithRelations[];
  currentUserId: string;
  channelType: db.ChannelType;
  unreadCount?: number;
  firstUnread?: string;
  setInputShouldBlur?: (shouldBlur: boolean) => void;
  selectedPost?: string;
  onStartReached?: () => void;
  onEndReached?: () => void;
  onPressReplies?: (post: db.PostWithRelations) => void;
  showReplies?: boolean;
}) {
  const [hasPressedGoToBottom, setHasPressedGoToBottom] = useState(false);
  const flatListRef = useRef<FlatList<db.PostWithRelations>>(null);

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
  }, [firstUnread]);

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
  }, [selectedPost]);

  const [activeMessage, setActiveMessage] =
    useState<db.PostWithRelations | null>(null);
  const activeMessageRefs = useRef<Record<string, RefObject<RNView>>>({});

  const handleSetActive = useCallback((active: db.PostWithRelations) => {
    activeMessageRefs.current[active.id] = createRef();
    setActiveMessage(active);
  }, []);

  const renderItem: ListRenderItem<db.PostWithRelations> = useCallback(
    ({ item }) => {
      return (
        <PressableMessage
          ref={activeMessageRefs.current[item.id]}
          onLongPress={() => handleSetActive(item)}
          isActive={activeMessage?.id === item.id}
        >
          <ChatMessage
            currentUserId={currentUserId}
            post={item}
            firstUnread={firstUnread}
            unreadCount={unreadCount}
            showReplies={showReplies}
            onPressReplies={onPressReplies}
          />
        </PressableMessage>
      );
    },
    [activeMessage, showReplies, firstUnread, onPressReplies, unreadCount]
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
    gap: '$m',
  }) as StyleProp<ViewStyle>;

  const handleContainerPressed = useCallback(() => {
    setInputShouldBlur?.(true);
  }, []);

  return (
    <View flex={1}>
      {unreadCount && !hasPressedGoToBottom && (
        <UnreadsButton onPress={pressedGoToBottom} />
      )}
      <FlatList<db.PostWithRelations>
        ref={flatListRef}
        data={posts}
        renderItem={renderItem}
        keyExtractor={getPostId}
        keyboardDismissMode="on-drag"
        onEndReached={onEndReached}
        onEndReachedThreshold={2}
        onStartReached={onStartReached}
        contentContainerStyle={contentContainerStyle}
        inverted
        onScrollBeginDrag={handleContainerPressed}
        onScrollToIndexFailed={handleScrollToIndexFailed}
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
  PropsWithChildren<{ isActive: boolean; onLongPress: () => void }>
>(({ isActive, onLongPress, children }, ref) => {
  return (
    // this markup isn't ideal, but you need the MotiView for animating, the Pressable for
    // customizing longpress duration, and the React Native View for ref measurement
    <MotiView
      animate={{
        scale: isActive ? 0.95 : 1,
      }}
      transition={{
        scale: {
          type: 'timing',
          duration: 50,
        },
      }}
    >
      <Pressable onLongPress={onLongPress} delayLongPress={250}>
        <RNView ref={ref}>
          <View paddingVertical="$m">{children}</View>
        </RNView>
      </Pressable>
    </MotiView>
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
