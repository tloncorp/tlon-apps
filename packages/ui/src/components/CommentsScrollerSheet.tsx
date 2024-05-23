import { makePrettyTime } from '@tloncorp/shared/dist';
import type * as api from '@tloncorp/shared/dist/api';
import type * as db from '@tloncorp/shared/dist/db';
import * as urbit from '@tloncorp/shared/dist/urbit';
import { useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTokenValue } from 'tamagui';

import { View } from '../core';
import { ActionSheet } from './ActionSheet';
import Scroller from './Channel/Scroller';
import { ChatMessage } from './ChatMessage';
import { MessageInput } from './MessageInput';
import PostScreenAuthorRow from './PostScreenAuthorRow';

export default function CommentsScrollerSheet({
  open,
  setOpen,
  channelId,
  currentUserId,
  editingPost,
  setEditingPost,
  sendReply,
  editPost,
  parentPost,
  posts,
  uploadInfo,
  groupMembers,
  storeDraft,
  clearDraft,
  getDraft,
  onPressImage,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  channelId: string;
  currentUserId: string;
  editingPost?: db.Post;
  setEditingPost?: (post: db.Post | undefined) => void;
  sendReply: (content: urbit.Story, channelId: string) => void;
  editPost: (post: db.Post, content: urbit.Story) => void;
  parentPost: db.Post;
  posts: db.Post[];
  uploadInfo: api.UploadInfo;
  groupMembers: db.ChatMember[];
  storeDraft: (draft: urbit.JSONContent) => void;
  clearDraft: () => void;
  getDraft: () => Promise<urbit.JSONContent>;
  onPressImage?: (post: db.Post, uri?: string) => void;
}) {
  const [inputShouldBlur, setInputShouldBlur] = useState(false);
  const { bottom } = useSafeAreaInsets();

  const timeDisplay = useMemo(() => {
    const date = new Date(parentPost?.sentAt ?? 0);
    return makePrettyTime(date);
  }, [parentPost?.sentAt]);

  return (
    <ActionSheet
      open={open}
      onOpenChange={setOpen}
      snapPointsMode="percent"
      snapPoints={[90]}
      disableDrag
    >
      <View height="100%" paddingBottom={bottom + getTokenValue('$2xl')}>
        <PostScreenAuthorRow
          parentPost={parentPost}
          timeDisplay={timeDisplay}
          setShowComments={() => {}}
        />
        <Scroller
          setInputShouldBlur={setInputShouldBlur}
          inverted
          renderItem={ChatMessage}
          channelType="chat"
          channelId={channelId}
          currentUserId={currentUserId}
          editingPost={editingPost}
          setEditingPost={setEditingPost}
          editPost={editPost}
          posts={posts}
          showReplies={false}
          onPressImage={onPressImage}
        />
        <View
          backgroundColor="$background"
          position={'absolute'}
          bottom={0}
          width="100%"
        >
          <MessageInput
            shouldBlur={inputShouldBlur}
            setShouldBlur={setInputShouldBlur}
            send={sendReply}
            channelId={channelId}
            uploadInfo={uploadInfo}
            groupMembers={groupMembers}
            storeDraft={storeDraft}
            clearDraft={clearDraft}
            getDraft={getDraft}
          />
        </View>
      </View>
    </ActionSheet>
  );
}
