import { makePrettyShortDate } from '@tloncorp/shared/dist';
import * as db from '@tloncorp/shared/dist/db';
import * as urbit from '@tloncorp/shared/dist/urbit';
import { getChannelType } from '@tloncorp/shared/dist/urbit';
import { PropsWithChildren, useMemo, useState } from 'react';
import { FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Text,
  View,
  YStack,
  getTokenValue,
  withStaticProperties,
} from 'tamagui';

import AuthorRow from '../AuthorRow';
import { BigInput } from '../BigInput';
import Scroller from '../Channel/Scroller';
import { ChatMessage } from '../ChatMessage';
import { MessageInput } from '../MessageInput';
import { DEFAULT_MESSAGE_INPUT_HEIGHT } from '../MessageInput';

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
  sendReply: (content: urbit.Story, channelId: string) => Promise<void>;
  groupMembers: db.ChatMember[];
  posts?: db.Post[];
  onPressImage?: (post: db.Post, imageUri?: string) => void;
  storeDraft: (draft: urbit.JSONContent) => void;
  clearDraft: () => void;
  getDraft: () => Promise<urbit.JSONContent>;
  goBack?: () => void;
  onPressRetry: (post: db.Post) => void;
  onPressDelete: (post: db.Post) => void;
}

const DetailViewMetaDataComponent = ({
  post,
  showReplyCount = false,
}: {
  post: db.Post;
  showReplyCount?: boolean;
}) => {
  const dateDisplay = useMemo(() => {
    const date = new Date(post.sentAt);

    return makePrettyShortDate(date);
  }, [post.sentAt]);

  const hasReplies = post.replyCount! > 0;

  return (
    <YStack gap="$l">
      <Text color="$tertiaryText">{dateDisplay}</Text>
      <AuthorRow
        authorId={post.authorId}
        author={post.author}
        sent={post.sentAt}
        type={post.type}
        detailView
      />
      {showReplyCount && hasReplies && (
        <Text color="$tertiaryText" fontWeight="$s" fontSize="$l">
          {post.replyCount} {post.replyCount === 1 ? 'reply' : 'replies'}
        </Text>
      )}
    </YStack>
  );
};

const DetailViewHeaderComponentFrame = ({
  replyCount,
  children,
}: PropsWithChildren<{
  replyCount: number;
}>) => {
  return (
    <YStack>
      <YStack
        gap="$xl"
        paddingHorizontal="$xl"
        borderBottomWidth={1}
        borderColor="$border"
      >
        {children}
      </YStack>
    </YStack>
  );
};

const DetailViewFrameComponent = ({
  post,
  initialPostUnread,
  editingPost,
  setEditingPost,
  editPost,
  sendReply,
  groupMembers,
  posts,
  onPressImage,
  storeDraft,
  clearDraft,
  getDraft,
  children,
  goBack,
  onPressRetry,
  onPressDelete,
}: DetailViewProps) => {
  const [messageInputHeight, setMessageInputHeight] = useState(
    DEFAULT_MESSAGE_INPUT_HEIGHT
  );
  const [activeMessage, setActiveMessage] = useState<db.Post | null>(null);
  const [inputShouldBlur, setInputShouldBlur] = useState(false);
  const { bottom } = useSafeAreaInsets();
  const isEditingParent = useMemo(() => {
    return editingPost?.id === post.id;
  }, [editingPost, post]);

  if (isEditingParent) {
    return (
      <BigInput
        channelType={getChannelType(post.channelId)}
        channelId={post.channelId}
        editingPost={editingPost}
        setEditingPost={setEditingPost}
        editPost={editPost}
        shouldBlur={inputShouldBlur}
        setShouldBlur={setInputShouldBlur}
        send={async () => {}}
        getDraft={getDraft}
        storeDraft={storeDraft}
        clearDraft={clearDraft}
        groupMembers={groupMembers}
      />
    );
  }

  return (
    <View flex={1} backgroundColor="$background">
      <FlatList
        data={[post]}
        ListHeaderComponent={children}
        contentContainerStyle={{
          paddingBottom: messageInputHeight + bottom + getTokenValue('$2xl'),
        }}
        renderItem={() => (
          <View paddingTop="$m" paddingHorizontal="$xs">
            <Scroller
              inverted
              renderItem={ChatMessage}
              channelType="chat"
              channelId={post.channelId}
              editingPost={editingPost}
              setEditingPost={setEditingPost}
              editPost={editPost}
              posts={posts ?? null}
              showReplies={false}
              onPressImage={onPressImage}
              onPressRetry={onPressRetry}
              onPressDelete={onPressDelete}
              firstUnreadId={
                initialPostUnread?.count ?? 0 > 0
                  ? initialPostUnread?.firstUnreadPostId
                  : null
              }
              unreadCount={initialPostUnread?.count ?? 0}
              activeMessage={activeMessage}
              setActiveMessage={setActiveMessage}
            />
          </View>
        )}
      />
      <View
        height={messageInputHeight + getTokenValue('$2xl') + bottom}
        position="absolute"
        width={'100%'}
        bottom={0}
        paddingTop={'$m'}
        backgroundColor="$background"
      >
        <MessageInput
          shouldBlur={inputShouldBlur}
          setShouldBlur={setInputShouldBlur}
          send={sendReply}
          channelId={post.channelId}
          groupMembers={groupMembers}
          storeDraft={storeDraft}
          clearDraft={clearDraft}
          getDraft={getDraft}
          backgroundColor="$background"
          showAttachmentButton={false}
          channelType="chat"
          placeholder="Reply"
          setHeight={setMessageInputHeight}
          // TODO: add back in when we switch to bottom nav
          // goBack={goBack}
        />
      </View>
    </View>
  );
};

export const DetailView = withStaticProperties(DetailViewFrameComponent, {
  MetaData: DetailViewMetaDataComponent,
  Header: DetailViewHeaderComponentFrame,
});
