import * as db from '@tloncorp/shared/db';
import { Text } from '@tloncorp/ui';
import { useEffect, useMemo } from 'react';
import { FlatList } from 'react-native';
import { View, YStack } from 'tamagui';

import Scroller from './Channel/Scroller';
import { ChatMessage } from './ChatMessage';
import { GalleryPostDetailView } from './GalleryPost/GalleryPost';
import { NotebookPostDetailView } from './NotebookPost/NotebookPost';

export interface DetailViewProps {
  post: db.Post;
  channel: db.Channel;
  initialPostUnread?: db.ThreadUnreadState | null;
  children?: JSX.Element;
  editingPost?: db.Post;
  setEditingPost?: (post: db.Post | undefined) => void;
  posts?: db.Post[];
  onPressImage?: (post: db.Post, imageUri?: string) => void;
  goBack?: () => void;
  onPressRetry?: (post: db.Post) => Promise<void>;
  onPressDelete: (post: db.Post) => void;
  setActiveMessage: (post: db.Post | null) => void;
  activeMessage: db.Post | null;
  editorIsFocused: boolean;
  flatListRef?: React.RefObject<FlatList>;
}

export const DetailView = ({
  post,
  channel,
  initialPostUnread,
  editingPost,
  setEditingPost,
  posts,
  onPressImage,
  onPressRetry,
  onPressDelete,
  setActiveMessage,
  activeMessage,
  editorIsFocused,
  flatListRef,
}: DetailViewProps) => {
  const channelType = channel.type;
  const isChat = channelType !== 'notebook' && channelType !== 'gallery';
  const resolvedPosts = useMemo(() => {
    return isChat && posts ? [...posts, post] : posts;
  }, [posts, post, isChat]);

  useEffect(() => {
    if (editorIsFocused && flatListRef) {
      flatListRef.current?.scrollToIndex({ index: 1, animated: true });
    }
  }, [editorIsFocused, flatListRef]);

  const containingProperties: any = useMemo(() => {
    return isChat
      ? {}
      : {
          width: '100%',
          marginHorizontal: 'auto',
          maxWidth: 600,
        };
  }, [isChat]);

  const scroller = useMemo(() => {
    return (
      <View
        {...containingProperties}
        paddingTop="$l"
        paddingHorizontal="$m"
        flex={1}
      >
        <Scroller
          inverted
          renderItem={ChatMessage}
          channel={channel}
          collectionLayoutType="compact-list-bottom-to-top"
          editingPost={editingPost}
          setEditingPost={setEditingPost}
          posts={resolvedPosts ?? null}
          showReplies={false}
          showDividers={isChat}
          onPressImage={onPressImage}
          onPressRetry={onPressRetry}
          onPressDelete={onPressDelete}
          firstUnreadId={
            initialPostUnread?.count ?? 0 > 0
              ? initialPostUnread?.firstUnreadPostId
              : null
          }
          renderEmptyComponent={RepliesEmptyComponent}
          unreadCount={initialPostUnread?.count ?? 0}
          activeMessage={activeMessage}
          setActiveMessage={setActiveMessage}
        />
      </View>
    );
  }, [
    containingProperties,
    activeMessage,
    editingPost,
    initialPostUnread,
    isChat,
    onPressDelete,
    onPressImage,
    onPressRetry,
    resolvedPosts,
    setActiveMessage,
    setEditingPost,
    channel,
  ]);

  return isChat ? (
    scroller
  ) : (
    <FlatList
      data={isChat ? ['posts'] : ['header', 'posts']}
      ref={flatListRef}
      onScrollToIndexFailed={(info) => {
        // Fallback: if scrollToIndex fails, wait briefly and scroll to end instead
        setTimeout(() => {
          flatListRef?.current?.scrollToEnd({ animated: true });
        }, 100);
      }}
      renderItem={({ item }) => {
        if (item === 'header') {
          return (
            <View width="100%" marginHorizontal="auto" maxWidth={600}>
              {channelType === 'gallery' ? (
                <GalleryPostDetailView
                  post={post}
                  onPressImage={onPressImage}
                />
              ) : channelType == 'notebook' ? (
                <NotebookPostDetailView
                  post={post}
                  onPressImage={onPressImage}
                />
              ) : null}
            </View>
          );
        }
        return scroller;
      }}
    />
  );
};

function RepliesEmptyComponent() {
  return (
    <YStack padding="$2xl" alignItems="center">
      <Text size="$body" color="$tertiaryText">
        No replies yet
      </Text>
    </YStack>
  );
}
