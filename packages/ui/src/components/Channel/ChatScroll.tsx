import * as db from '@tloncorp/shared/dist/db';
import { useEffect, useRef, useState } from 'react';
import { Dimensions, FlatList } from 'react-native';
import { Button } from 'tamagui';

import { ArrowDown } from '../../assets/icons';
import { Dialog, Modal, SizableText, View, XStack, YStack } from '../../core';
import ChatMessage from '../ChatMessage';
import { ChatMessageActions } from '../ChatMessage/ChatMessageActions';

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
  const [activeMessage, setActiveMessage] =
    useState<db.PostWithRelations | null>(null);
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
            <YStack paddingVertical="$m">
              <View onLongPress={() => setActiveMessage(item)}>
                <ChatMessage
                  post={item}
                  firstUnread={firstUnread}
                  unreadCount={unreadCount}
                />
              </View>
            </YStack>
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
      {/* {posts.length > 0 && (
        <Dialog open={true}>
          <Dialog.Portal>
            <ChatMessageActions post={posts[0]} />
          </Dialog.Portal>
        </Dialog>
      )} */}
      <Modal
        visible={activeMessage !== null}
        onDismiss={() => setActiveMessage(null)}
      >
        <ChatMessageActions post={activeMessage} />
      </Modal>
    </XStack>
  );
}
