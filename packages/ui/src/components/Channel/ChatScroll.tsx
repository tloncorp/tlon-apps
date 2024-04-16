import * as db from '@tloncorp/shared/dist/db';
import { MotiView } from 'moti';
import {
  RefObject,
  createRef,
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
  View as RNView,
  StyleProp,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { useStyle } from 'tamagui';

import { ArrowDown } from '../../assets/icons';
import { Dialog, Modal, SizableText, View, XStack, YStack } from '../../core';
import { Button } from '../Button';
import ChatMessage from '../ChatMessage';
import {
  ChatMessageActions,
  EmojiToolbar,
} from '../ChatMessage/ChatMessageActions';

export default function ChatScroll({
  posts,
  channelType,
  unreadCount,
  firstUnread,
  setInputShouldBlur,
  selectedPost,
  onStartReached,
  onEndReached,
}: {
  posts: db.PostWithRelations[];
  channelType: db.ChannelType;
  unreadCount?: number;
  firstUnread?: string;
  setInputShouldBlur: (shouldBlur: boolean) => void;
  selectedPost?: string;
  onStartReached?: () => void;
  onEndReached?: () => void;
}) {
  const [hasPressedGoToBottom, setHasPressedGoToBottom] = useState(false);
  const flatListRef = useRef<FlatList<db.PostWithRelations>>(null);
  const lastPost = useMemo(() => posts[posts.length - 1], [posts]);
  const sortedPosts = useMemo(
    () =>
      posts.sort((a, b) => {
        return b.receivedAt - a.receivedAt;
      }),
    [posts]
  );
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

  // const renderItem: ListRenderItem<db.PostWithRelations> = useCallback(
  //   ({ item }) => {
  //     return (
  //       <ChatMessage
  //         post={item}
  //         firstUnread={firstUnread}
  //         unreadCount={unreadCount}
  //       />
  //     );
  //   },
  //   []
  // );

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
    setInputShouldBlur(true);
  }, []);

  // start context menu
  const [activeMessage, setActiveMessage] =
    useState<db.PostWithRelations | null>(null);
  const activeMessageRefs = useRef<Record<string, RefObject<RNView>>>({});

  const handleSetActive = useCallback((active: db.PostWithRelations) => {
    activeMessageRefs.current[active.id] = createRef();
    setActiveMessage(active);
  }, []);

  return (
    <View onPress={handleContainerPressed}>
      {unreadCount && !hasPressedGoToBottom && (
        <UnreadsButton onPress={pressedGoToBottom} />
      )}
      <FlatList<db.PostWithRelations>
        ref={flatListRef}
        data={posts}
        renderItem={({ item }) => (
          <MotiView
            animate={{
              scale: activeMessage?.id === item.id ? 0.95 : 1,
            }}
            transition={{
              scale: {
                type: 'timing',
                duration: 100,
              },
            }}
          >
            <TouchableOpacity
              onLongPress={() => handleSetActive(item)}
              delayLongPress={300}
            >
              <RNView ref={activeMessageRefs.current[item.id]}>
                <View
                  paddingVertical="$m"
                  onLongPress={() => handleSetActive(item)}
                >
                  <ChatMessage
                    post={item}
                    firstUnread={firstUnread}
                    unreadCount={unreadCount}
                  />
                </View>
              </RNView>
            </TouchableOpacity>
          </MotiView>
        )}
        keyExtractor={getPostId}
        keyboardDismissMode="on-drag"
        onEndReached={onEndReached}
        onEndReachedThreshold={2}
        onStartReached={onStartReached}
        contentContainerStyle={contentContainerStyle}
        inverted
        onScrollToIndexFailed={handleScrollToIndexFailed}
      />
      <Modal
        visible={activeMessage !== null}
        onDismiss={() => setActiveMessage(null)}
      >
        {activeMessage !== null && (
          <ChatMessageActions
            post={activeMessage!}
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
