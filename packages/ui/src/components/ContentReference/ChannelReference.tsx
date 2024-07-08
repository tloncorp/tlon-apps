import { getChannelType } from '@tloncorp/shared/dist/urbit';

import { PostViewMode } from '../ContentRenderer';
import ChatReferenceWrapper from './ChatReferenceWrapper';
import ReferenceSkeleton from './ReferenceSkeleton';

export default function ChannelReference({
  channelId,
  postId,
  replyId,
  asAttachment = false,
  viewMode = 'chat',
}: {
  channelId: string;
  postId: string;
  replyId?: string;
  asAttachment?: boolean;
  viewMode?: PostViewMode;
}) {
  const channelType = getChannelType(channelId);

  if (channelType === 'chat') {
    return (
      <ChatReferenceWrapper
        asAttachment={asAttachment}
        viewMode={viewMode}
        channelId={channelId}
        postId={postId}
        replyId={replyId}
      />
    );
  }

  if (channelType === 'notebook') {
    // TODO: Implement notebook reference
    return (
      <ReferenceSkeleton
        message="Notebook references are not yet supported"
        messageType="error"
      />
    );
  }

  if (channelType === 'gallery') {
    // TODO: Implement gallery reference
    return (
      <ReferenceSkeleton
        message="Gallery references are not yet supported"
        messageType="error"
      />
    );
  }

  return (
    <ReferenceSkeleton message="Unsupported channel type" messageType="error" />
  );
}
