import { ContentReference as ContentReferenceType } from '@tloncorp/shared/dist/api';

import { PostViewMode } from '../ContentRenderer';
import { GroupReference } from './GroupReference';
import { PostReferenceLoader } from './PostReference';
import { ReferenceSkeleton } from './Reference';

export function ContentReference({
  reference,
  viewMode = 'chat',
}: {
  reference: ContentReferenceType;
  viewMode?: PostViewMode;
}) {
  if (reference.referenceType === 'channel') {
    return (
      <PostReferenceLoader
        channelId={reference.channelId}
        postId={reference.postId}
        replyId={reference.replyId}
      />
    );
  } else if (reference.referenceType === 'group') {
    return <GroupReference groupId={reference.groupId} />;
  } else if (reference.referenceType === 'app') {
    return (
      <ReferenceSkeleton
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
