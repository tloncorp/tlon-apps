import { makePrettyDayAndTime } from '@tloncorp//shared/dist/logic';
import * as api from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import * as ub from '@tloncorp/shared/dist/urbit';

import { SizableText, View, XStack } from '../../core';
import ContentRenderer from '../ContentRenderer';
import { GalleryPost } from '../GalleryPost';

export function ActivityEventContent({
  summary,
}: {
  summary: db.SourceActivityEvents;
}) {
  const newest = summary.newest;
  const post = getPost(newest);

  // thread or comment
  if (newest.parentId) {
    return (
      <View marginTop="$s" marginRight="$xl">
        <ContentRenderer post={post} viewMode="activity" />
      </View>
    );
  }

  if (newest.channel?.type === 'gallery') {
    const allPosts = summary.all.map((event) => getPost(event));

    // TODO: why is this needed?
    const seen = new Set();
    const uniquePosts = allPosts.filter((item) => {
      if (seen.has(item.id)) {
        return false;
      }
      seen.add(item.id);
      return true;
    });

    return (
      <XStack marginTop="$s" gap="$s" overflow="hidden">
        {uniquePosts.map((post) => (
          <GalleryPost key={post.id} post={post} viewMode="activity" />
        ))}
      </XStack>
    );
  }

  return (
    <View marginTop="$s" marginRight="$xl">
      <ContentRenderer post={post} viewMode="activity" />
    </View>
  );
}

function getPost(event: db.ActivityEvent): db.Post {
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

  return post;
}

function PostDate({ event }: { event: db.ActivityEvent }) {
  const display = makePrettyDayAndTime(new Date(event.timestamp ?? Date.now()));
  return (
    <SizableText fontSize="$s" color="$secondaryText">
      {display}
    </SizableText>
  );
}
