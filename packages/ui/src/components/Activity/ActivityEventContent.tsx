import * as api from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import * as ub from '@tloncorp/shared/dist/urbit';

import ContentRenderer from '../ContentRenderer';
import { GalleryPost } from '../GalleryPost';

export function ActivityEventContent({ event }: { event: db.ActivityEvent }) {
  const parsed = api.toPostContent(event.content as ub.Verse[]);
  const content = parsed[0];

  let post: db.Post;
  if (event.post) {
    post = event.post;
  } else {
    // %activity gives us partials so...square peg, round hole
    post = db.buildPendingPost({
      authorId: event.authorId ?? '',
      content: content as ub.Story,
      channel: event.channel!,
    });
  }

  // thread or comment
  if (event.parentId) {
    return <ContentRenderer post={post} viewMode="activity" />;
  }

  if (event.channel?.type === 'gallery') {
    // todo: make activity shaped
    return <GalleryPost post={post} />;
  }

  return <ContentRenderer post={post} viewMode="activity" />;
}
