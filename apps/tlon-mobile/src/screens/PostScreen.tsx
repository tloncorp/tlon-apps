import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/dist/store';
import { PostScreenView } from '@tloncorp/ui';
import React, { useEffect, useMemo } from 'react';

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
  });
  const { data: channel } = store.useChannel({ id: postParam.channelId });

  useEffect(() => {
    store.syncThreadPosts({
      postId: postParam.id,
      authorId: postParam.authorId,
      channelId: postParam.channelId,
    });
  }, [postParam]);

  const posts = useMemo(() => {
    return post ? [...(threadPosts ?? []), post] : null;
  }, [post, threadPosts]);

  return (
    <PostScreenView
      posts={posts}
      channel={channel ?? null}
      goBack={props.navigation.goBack}
    />
  );
}
