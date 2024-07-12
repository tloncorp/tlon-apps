import { ContentReference as ContentReferenceType } from '@tloncorp/shared/dist/api';

import { PostViewMode } from '../ContentRenderer';
import ChannelReference from './ChannelReference';
import { GroupReference } from './GroupReference';
import ReferenceSkeleton from './ReferenceSkeleton';

export default function ContentReference({
  reference,
  asAttachment = false,
  viewMode = 'chat',
}: {
  reference: ContentReferenceType;
  asAttachment?: boolean;
  viewMode?: PostViewMode;
}) {
  if (reference.referenceType === 'channel') {
    return (
      <ChannelReference
        channelId={reference.channelId}
        postId={reference.postId}
        replyId={reference.replyId}
        asAttachment={asAttachment}
        viewMode={viewMode}
      />
    );
  }

  if (reference.referenceType === 'group') {
    return <GroupReference groupId={reference.groupId} viewMode={viewMode} />;
  }

  if (reference.referenceType === 'app') {
    return (
      <ReferenceSkeleton
        viewMode={viewMode}
        message="App references are not yet supported"
        messageType="error"
      />
    );
  }

  return (
    <ReferenceSkeleton
      message="Unsupported reference type"
      messageType="error"
    />
  );
}
