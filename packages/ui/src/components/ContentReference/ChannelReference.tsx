import { getChannelType } from '@tloncorp/shared/dist/urbit';

import { PostViewMode } from '../ContentRenderer';
import ChatReferenceWrapper from './ChatReferenceWrapper';
import GalleryReferenceWrapper from './GalleryReferenceWrapper';
import NotebookReferenceWrapper from './NotebookReferenceWrapper';
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
    return (
      <NotebookReferenceWrapper
        asAttachment={asAttachment}
        viewMode={viewMode}
        channelId={channelId}
        postId={postId}
      />
    );
  }

  if (channelType === 'gallery') {
    // TODO: Implement gallery reference
    return (
      <GalleryReferenceWrapper
        asAttachment={asAttachment}
        viewMode={viewMode}
        channelId={channelId}
        postId={postId}
      />
    );
  }

  return (
    <ReferenceSkeleton message="Unsupported channel type" messageType="error" />
  );
}
