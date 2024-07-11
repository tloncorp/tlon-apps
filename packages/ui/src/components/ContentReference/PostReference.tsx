import * as db from '@tloncorp/shared/dist/db';
import { getChannelType } from '@tloncorp/shared/dist/urbit';
import { ComponentProps, useCallback } from 'react';

import { useNavigation } from '../../contexts';
import { useRequests } from '../../contexts/requests';
import { ContactAvatar } from '../Avatar';
import ContactName from '../ContactName';
import ContentRenderer from '../ContentRenderer';
import {
  Reference,
  ReferenceContext,
  ReferenceSkeleton,
  useReferenceContext,
} from './Reference';

export function PostReferenceLoader({
  channelId,
  postId,
  replyId,
  ...props
}: Omit<ComponentProps<typeof PostReference>, 'post'> & {
  channelId: string;
  postId: string;
  replyId?: string;
}) {
  const { usePostReference, useChannel } = useRequests();
  const {
    data: post,
    isError,
    error,
    isLoading,
  } = usePostReference({
    postId: replyId ? replyId : postId,
    channelId: channelId,
  });
  const { data: channel } = useChannel({ id: channelId });
  const { onPressRef } = useNavigation();
  const handlePress = useCallback(() => {
    if (channel && post) {
      onPressRef(channel, post);
    }
  }, [channel, onPressRef, post]);

  if (isLoading) {
    return <ReferenceSkeleton messageType="loading" {...props} />;
  } else if (isError) {
    return (
      <ReferenceSkeleton
        message={error?.message || 'Error loading content'}
        messageType="error"
        {...props}
      />
    );
  } else if (!post) {
    return (
      <ReferenceSkeleton
        messageType="not-found"
        message="This content could not be found"
        {...props}
      />
    );
  }
  return (
    <PostReference
      post={post}
      onPress={props.viewMode === 'attachment' ? undefined : handlePress}
      {...props}
    />
  );
}

export const PostReference = Reference.styleable<{
  post: db.Post;
}>(
  function PostReference({ post, ...props }, ref) {
    const channelType = getChannelType(post.channelId);
    const { viewMode } = useReferenceContext();
    const shortened =
      channelType === 'gallery'
        ? false
        : channelType === 'notebook'
          ? true
          : viewMode === 'attachment' || viewMode === 'block';

    return (
      <Reference viewMode={viewMode} {...props} ref={ref}>
        <Reference.Header>
          <Reference.Title>
            <ContactAvatar contactId={post.authorId} size="$xl" />
            <ContactName
              color="$tertiaryText"
              size="$s"
              userId={post.authorId}
              showNickname
            />
          </Reference.Title>
          <Reference.Icon type="ArrowRef" />
        </Reference.Header>
        <Reference.Body>
          <ContentRenderer
            viewMode={viewMode}
            shortened={shortened}
            post={post}
          />
        </Reference.Body>
      </Reference>
    );
  },
  {
    staticConfig: {
      componentName: 'PostReference',
      context: ReferenceContext,
    },
  }
);
