import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { sync } from '@tloncorp/shared';
import * as store from '@tloncorp/shared/dist/store';
import * as urbit from '@tloncorp/shared/dist/urbit';
import { PostScreenView } from '@tloncorp/ui';
import React, { useEffect, useMemo } from 'react';

import { useShip } from '../contexts/ship';
import type { HomeStackParamList } from '../types';

type PostScreenProps = NativeStackScreenProps<HomeStackParamList, 'Post'>;

export default function PostScreen(props: PostScreenProps) {
  const postParam = props.route.params.post;
  const { data: post } = store.usePostWithRelations({
    id: postParam.id,
  });
  const { data: threadPosts } = store.useThreadPosts({
    postId: postParam.id,
    authorId: postParam.authorId,
    channelId: postParam.channelId,
  });
  const { data: channel } = store.useChannel({ id: postParam.channelId });
  const groupQuery = store.useGroup({
    id: channel?.groupId ?? '',
  });
  const { contactId } = useShip();

  const posts = useMemo(() => {
    return post ? [...(threadPosts ?? []), post] : null;
  }, [post, threadPosts]);

  useEffect(() => {
    sync.syncGroup(channel?.groupId ?? '');
  }, [channel?.groupId]);

  const sendReply = async (content: urbit.Story) => {
    store.sendReply({
      authorId: contactId!,
      content,
      channel: channel!,
      parentId: post!.id,
      parentAuthor: post!.authorId,
    });
  };

  return contactId ? (
    <PostScreenView
      currentUserId={contactId}
      posts={posts}
      channel={channel ?? null}
      goBack={props.navigation.goBack}
      sendReply={sendReply}
      groupMembers={groupQuery.data?.members ?? []}
    />
  ) : null;
}
