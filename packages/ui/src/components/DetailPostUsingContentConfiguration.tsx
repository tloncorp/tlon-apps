import * as db from '@tloncorp/shared/db';
import { YStack } from 'tamagui';

import { usePostCollectionContextUnsafelyUnwrapped } from '../contexts/postCollection';
import { ForwardingProps } from '../utils/react';
import { ChannelHeader } from './Channel/ChannelHeader';

export function DetailPostView({
  post,
  navigateBack,
  ...forwardedProps
}: ForwardingProps<
  typeof YStack,
  { post: db.Post; navigateBack?: () => void },
  'backgroundColor'
>) {
  const { PostView, channel } = usePostCollectionContextUnsafelyUnwrapped();
  // use boolean coercion to also check if post.title is empty string
  const title = post.title ? post.title : 'Post';
  return (
    <YStack backgroundColor={'$background'} {...forwardedProps}>
      <ChannelHeader
        channel={channel}
        group={channel.group}
        title={title}
        goBack={navigateBack}
        showSearchButton={false}
        // showSpinner={isLoadingPosts}
        post={post}
        mode="default"
      />
      <PostView post={post} />
    </YStack>
  );
}
