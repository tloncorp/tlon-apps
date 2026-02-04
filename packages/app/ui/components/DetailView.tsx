import * as db from '@tloncorp/shared/db';
import { Text } from '@tloncorp/ui';
import { ReactNode, useEffect, useMemo } from 'react';
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
  children?: ReactNode;
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
  flatListRef?: React.RefObject<FlatList | null>;
  scrollerRef?: React.RefObject<{
    scrollToStart: (opts: { animated?: boolean }) => void;
    scrollToEnd: (opts: { animated?: boolean }) => void;
  } | null>;
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
  scrollerRef,
}: DetailViewProps) => {
  const channelType = channel.type;
  const isChat = channelType !== 'notebook' && channelType !== 'gallery';
  const resolvedPosts = useMemo(() => {
    if (isChat) {
      return posts ? [...posts, post] : posts;
    }
    return posts ? [...posts].reverse() : posts;
  }, [posts, post, isChat]);

  const containingProperties: any = useMemo(() => {
    return isChat
      ? {}
      : {
          width: '100%',
          marginHorizontal: 'auto',
          maxWidth: 600,
        };
  }, [isChat]);

  const listHeaderComponent = useMemo(() => {
    if (isChat) {
      return undefined;
    }
    return (
      <View width="100%" marginHorizontal="auto" maxWidth={600}>
        {channelType === 'gallery' ? (
          <GalleryPostDetailView post={post} onPressImage={onPressImage} />
        ) : channelType === 'notebook' ? (
          <NotebookPostDetailView post={post} onPressImage={onPressImage} />
        ) : null}
      </View>
    );
  }, [isChat, channelType, post, onPressImage]);

  return (
    <View
      paddingTop="$l"
      paddingHorizontal={isChat ? '$m' : undefined}
      flex={1}
      {...containingProperties}
    >
      <Scroller
        ref={scrollerRef}
        inverted={isChat}
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
        listHeaderComponent={listHeaderComponent}
      />
    </View>
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
