import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import * as urbit from '@tloncorp/shared/dist/urbit';
import { PostScreenView } from '@tloncorp/ui';
import { useCallback, useMemo } from 'react';

import { useShip } from '../contexts/ship';
import { useImageUpload } from '../hooks/useImageUpload';
import type { HomeStackParamList } from '../types';

type PostScreenProps = NativeStackScreenProps<HomeStackParamList, 'Post'>;

// TODO: Pull from actual settings
const defaultCalmSettings = {
  disableAppTileUnreads: false,
  disableAvatars: false,
  disableNicknames: false,
  disableRemoteContent: false,
  disableSpellcheck: false,
};

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
  const { data: contacts } = store.useContacts();
  const { contactId } = useShip();
  const uploadInfo = useImageUpload({
    uploaderKey: `${postParam.channelId}/${postParam.id}`,
  });

  const posts = useMemo(() => {
    return post ? [...(threadPosts ?? []), post] : null;
  }, [post, threadPosts]);

  const sendReply = async (content: urbit.Story) => {
    store.sendReply({
      authorId: contactId!,
      content,
      channel: channel!,
      parentId: post!.id,
      parentAuthor: post!.authorId,
    });
    uploadInfo.resetImageAttachment();
  };

  const handleGoToImage = useCallback(
    (post: db.Post, uri?: string) => {
      // @ts-expect-error TODO: fix typing for nested stack navigation
      props.navigation.navigate('ImageViewer', { post, uri });
    },
    [props.navigation]
  );

  return contactId ? (
    <PostScreenView
      contacts={contacts ?? null}
      calmSettings={defaultCalmSettings}
      currentUserId={contactId}
      posts={posts}
      channel={channel ?? null}
      goBack={props.navigation.goBack}
      sendReply={sendReply}
      uploadInfo={uploadInfo}
      handleGoToImage={handleGoToImage}
    />
  ) : null;
}
