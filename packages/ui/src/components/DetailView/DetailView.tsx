import * as db from '@tloncorp/shared/dist/db';
import * as urbit from '@tloncorp/shared/dist/urbit';
import { useMemo } from 'react';
import { FlatList } from 'react-native';
import { View, YStack } from 'tamagui';

import Scroller from '../Channel/Scroller';
import { ChatMessage } from '../ChatMessage';
import { GalleryPostDetailView } from '../GalleryPost/GalleryPost';
import { NotebookPostDetailView } from '../NotebookPost/NotebookPost';
import { Text } from '../TextV2';

export interface DetailViewProps {
  post: db.Post;
  initialPostUnread?: db.ThreadUnreadState | null;
  children?: JSX.Element;
  editingPost?: db.Post;
  setEditingPost?: (post: db.Post | undefined) => void;
  editPost?: (
    post: db.Post,
    content: urbit.Story,
    parentId?: string,
    metadata?: db.PostMetadata
  ) => Promise<void>;
  posts?: db.Post[];
  onPressImage?: (post: db.Post, imageUri?: string) => void;
  goBack?: () => void;
  onPressRetry: (post: db.Post) => void;
  onPressDelete: (post: db.Post) => void;
  setActiveMessage: (post: db.Post | null) => void;
  activeMessage: db.Post | null;
}

export const DetailView = ({
  post,
  initialPostUnread,
  editingPost,
  setEditingPost,
  editPost,
  posts,
  onPressImage,
  onPressRetry,
  onPressDelete,
  setActiveMessage,
  activeMessage,
}: DetailViewProps) => {
  const channelType = useMemo(
    () => urbit.getChannelType(post.channelId),
    [post.channelId]
  );
  const isChat = channelType !== 'notebook' && channelType !== 'gallery';
  const resolvedPosts = useMemo(() => {
    return isChat && posts ? [...posts, post] : posts;
  }, [posts, post, isChat]);

  const scroller = useMemo(() => {
    return (
      <View paddingTop="$l" paddingHorizontal="$m" flex={1}>
        <Scroller
          inverted
          renderItem={ChatMessage}
          channelType="chat"
          channelId={post.channelId}
          editingPost={editingPost}
          setEditingPost={setEditingPost}
          editPost={editPost}
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
    activeMessage,
    editPost,
    editingPost,
    initialPostUnread,
    isChat,
    onPressDelete,
    onPressImage,
    onPressRetry,
    post.channelId,
    resolvedPosts,
    setActiveMessage,
    setEditingPost,
  ]);

  return isChat ? (
    scroller
  ) : (
    <FlatList
      data={isChat ? ['posts'] : ['header', 'posts']}
      renderItem={({ item }) => {
        if (item === 'header') {
          return (
            <View>
              {channelType === 'gallery' ? (
                <GalleryPostDetailView post={post} />
              ) : channelType == 'notebook' ? (
                <NotebookPostDetailView post={post} />
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
