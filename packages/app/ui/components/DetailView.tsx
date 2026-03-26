import * as db from '@tloncorp/shared/db';
import { Text } from '@tloncorp/ui';
import { useMemo } from 'react';
import { View, YStack } from 'tamagui';

import Scroller, { ScrollAnchor } from './Channel/Scroller';
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
  onPressImage?: (post: db.Post, imageUri: string) => void;
  goBack?: () => void;
  onPressRetry?: (post: db.Post) => Promise<void>;
  onPressDelete: (post: db.Post) => void;
  setActiveMessage: (post: db.Post | null) => void;
  activeMessage: db.Post | null;
  anchor?: ScrollAnchor | null;
  highlightPostId?: string | null;
  scrollerRef?: React.RefObject<{
    scrollToStart: (opts: { animated?: boolean }) => void;
    scrollToEnd: (opts: { animated?: boolean }) => void;
  }>;
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
  anchor,
  highlightPostId,
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
        anchor={anchor}
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
        highlightPostId={highlightPostId}
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
