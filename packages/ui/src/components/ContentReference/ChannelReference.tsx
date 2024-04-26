import { getChannelType } from '@tloncorp/shared/dist/urbit';

import { Text } from '../../core';
import ChatReferenceWrapper from './ChatReferenceWrapper';

export default function ChannelReference({
  channelId,
  postId,
}: {
  channelId: string;
  postId: string;
}) {
  const channelType = getChannelType(channelId);

  if (channelType === 'chat') {
    return <ChatReferenceWrapper channelId={channelId} postId={postId} />;
  }

  if (channelType === 'notebook') {
    return <Text>Notebook reference</Text>;
  }

  if (channelType === 'gallery') {
    return <Text>Gallery reference</Text>;
  }

  return <Text>Unknown channel type</Text>;
}
