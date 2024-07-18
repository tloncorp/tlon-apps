import { makePrettyShortDate } from '@tloncorp/shared/dist';
import type * as api from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import * as urbit from '@tloncorp/shared/dist/urbit';
import { PropsWithChildren, useMemo, useState } from 'react';
import { FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTokenValue, withStaticProperties } from 'tamagui';

import { Text, View, YStack } from '../../core';
import { useStickyUnread } from '../../hooks/useStickyUnread';
import AuthorRow from '../AuthorRow';
import Scroller from '../Channel/Scroller';
import { ChatMessage } from '../ChatMessage';
import { MessageInput } from '../MessageInput';
import { DEFAULT_MESSAGE_INPUT_HEIGHT } from '../MessageInput/index.native';

export interface DetailViewProps {
  post: db.Post;
  children?: JSX.Element;
  editingPost?: db.Post;
  setEditingPost?: (post: db.Post | undefined) => void;
  editPost?: (post: db.Post, content: urbit.Story) => Promise<void>;
  sendReply: (content: urbit.Story, channelId: string) => Promise<void>;
  groupMembers: db.ChatMember[];
  posts?: db.Post[];
  onPressImage?: (post: db.Post, imageUri?: string) => void;
  uploadInfo: api.UploadInfo;
  storeDraft: (draft: urbit.JSONContent) => void;
  clearDraft: () => void;
  getDraft: () => Promise<urbit.JSONContent>;
  goBack?: () => void;
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
  editingPost,
  setEditingPost,
  editPost,
  sendReply,
  groupMembers,
  posts,
  onPressImage,
  uploadInfo,
  storeDraft,
  clearDraft,
  getDraft,
  children,
  goBack,
}: DetailViewProps) => {
  const [messageInputHeight, setMessageInputHeight] = useState(
    DEFAULT_MESSAGE_INPUT_HEIGHT
  );
  const [activeMessage, setActiveMessage] = useState<db.Post | null>(null);
  const threadUnread = useStickyUnread(post?.threadUnread);
  const [inputShouldBlur, setInputShouldBlur] = useState(false);
  const { bottom } = useSafeAreaInsets();
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
              firstUnreadId={
                threadUnread?.count ?? 0 > 0
                  ? threadUnread?.firstUnreadPostId
                  : null
              }
              unreadCount={threadUnread?.count ?? 0}
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
          uploadInfo={uploadInfo}
          groupMembers={groupMembers}
          storeDraft={storeDraft}
          clearDraft={clearDraft}
          getDraft={getDraft}
          backgroundColor="$background"
          showAttachmentButton={false}
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
