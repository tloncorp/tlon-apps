import * as db from '@tloncorp/shared/dist/db';
// import ContextMenu from 'react-native-context-menu-view';
// import * as ContextMenu from 'zeego/context-menu';
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
  View as RNView,
  TouchableOpacity,
} from 'react-native';
import { Button } from 'tamagui';

import { ArrowDown } from '../../assets/icons';
import { Dialog, Modal, SizableText, View, XStack, YStack } from '../../core';
import ChatMessage from '../ChatMessage';
import {
  ChatMessageActions,
  EmojiToolbar,
} from '../ChatMessage/ChatMessageActions';

const renderItem = ({
  post,
  firstUnread,
  unreadCount,
}: {
  post: db.PostWithRelations;
  firstUnread?: string;
  unreadCount?: number;
}) => (
  <YStack paddingVertical="$m">
    <ChatMessage
      post={post}
      firstUnread={firstUnread}
      unreadCount={unreadCount}
    />
  </YStack>
);

export default function ChatScroll({
  posts,
  unreadCount,
  firstUnread,
  selectedPost,
}: {
  posts: db.PostWithRelations[];
  unreadCount?: number;
  firstUnread?: string;
  selectedPost?: string;
}) {
  const [hasPressedGoToBottom, setHasPressedGoToBottom] = useState(false);
  const flatListRef = useRef<FlatList<db.PostWithRelations>>(null);
  const lastPost = posts[posts.length - 1];
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

  // start context menu
  const [activeMessage, setActiveMessage] =
    useState<db.PostWithRelations | null>(null);
  const activeMessageRefs = useRef<Record<string, RefObject<RNView>>>({});

  const handleSetActive = useCallback((active: db.PostWithRelations) => {
    activeMessageRefs[active.id] = createRef();
    setActiveMessage(active);
  }, []);

  return (
    <XStack position="relative" flex={1}>
      {unreadCount && !hasPressedGoToBottom && (
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
            // height="$3xl"
            height="$4xl"
            width="100%"
            alignItems="center"
            // alignSelf="center"
            elevation="$s"
            onPress={pressedGoToBottom}
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
      )}
      <XStack flex={1} paddingHorizontal="$m">
        <FlatList
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
                <RNView ref={activeMessageRefs[item.id]}>
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
          keyExtractor={(post) => post.id}
          keyboardDismissMode="on-drag"
          inverted
          onScrollToIndexFailed={({
            index,
            highestMeasuredFrameIndex,
            averageItemLength,
          }) => {
            console.log('failed');

            const wait = new Promise((resolve) => setTimeout(resolve, 100));
            wait.then(() => {
              flatListRef.current?.scrollToIndex({
                index,
                animated: false,
              });
            });
          }}
        />
      </XStack>
      <Modal
        visible={activeMessage !== null}
        onDismiss={() => setActiveMessage(null)}
      >
        {activeMessage !== null && (
          <ChatMessageActions
            post={activeMessage!}
            postRef={activeMessageRefs[activeMessage!.id]}
            onDismiss={() => setActiveMessage(null)}
          />
        )}
      </Modal>
    </XStack>
  );
}

/* <ContextMenu
                actions={[{ title: 'Title 1' }, { title: 'Title 2' }]}
                onPress={(e) => {
                  console.warn(
                    `Pressed ${e.nativeEvent.name} at index ${e.nativeEvent.index}`
                  );
                }}
                preview={<ChatMessageActions post={item} />}
              >
                <View backgroundColor="transparent">
                  <ChatMessage
                    post={item}
                    firstUnread={firstUnread}
                    unreadCount={unreadCount}
                  />
                </View>
              </ContextMenu> */

/* <ContextMenu.Root>
                <ContextMenu.Trigger>
                  <ChatMessage
                    post={item}
                    firstUnread={firstUnread}
                    unreadCount={unreadCount}
                  />
                </ContextMenu.Trigger>
                <ContextMenu.Content>
                  <ContextMenu.Preview>
                    <ChatMessageActions post={item} />
                  </ContextMenu.Preview>
                  <ContextMenu.Item key="testing">
                    <ContextMenu.ItemTitle>Testing</ContextMenu.ItemTitle>
                  </ContextMenu.Item>
                  <ContextMenu.Item key="Another">
                    <ContextMenu.ItemTitle>Another</ContextMenu.ItemTitle>
                  </ContextMenu.Item>
                  <ContextMenu.Item key="orange" destructive>
                    <ContextMenu.ItemTitle>Bad</ContextMenu.ItemTitle>
                  </ContextMenu.Item>
                </ContextMenu.Content>
              </ContextMenu.Root>
            </YStack> */
