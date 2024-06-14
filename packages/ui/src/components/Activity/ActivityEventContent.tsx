import * as db from '@tloncorp/shared/dist/db';
import * as logic from '@tloncorp/shared/dist/logic';
import * as ub from '@tloncorp/shared/dist/urbit';

import { ScrollView, View } from '../../core';
import ContentRenderer from '../ContentRenderer';
import { GalleryPost } from '../GalleryPost';
import { NotebookPost } from '../NotebookPost';

export function ActivityEventContent({
  summary,
  pressHandler,
}: {
  summary: logic.SourceActivityEvents;
  pressHandler?: () => void;
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

  if (
    newest.channel?.type === 'gallery' ||
    newest.channel?.type === 'notebook'
  ) {
    const allPosts = summary.all?.map((event) => getPost(event)) ?? []; // defensive

    // TODO: i don't _think_ we're still seeing dupes here?
    const seen = new Set();
    const uniquePosts = allPosts.filter((item) => {
      if (seen.has(item.id)) {
        return false;
      }
      seen.add(item.id);
      return true;
    });

    return (
      <ScrollView
        marginTop="$s"
        marginRight="$xl"
        gap="$s"
        horizontal
        alwaysBounceHorizontal={false}
        showsHorizontalScrollIndicator={false}
      >
        {newest.channel?.type === 'notebook' ? (
          <>
            {uniquePosts.map((post) => (
              <View key={post.id} marginRight="$s" onPress={pressHandler}>
                <NotebookPost
                  post={post}
                  viewMode="activity"
                  smallImage
                  smallTitle
                />
              </View>
            ))}
          </>
        ) : (
          <>
            {uniquePosts.map((post) => (
              <View key={post.id} onPress={pressHandler}>
                <GalleryPost post={post} viewMode="activity" />
              </View>
            ))}
          </>
        )}
      </ScrollView>
    );
  }

  return (
    <View marginTop="$s" marginRight="$xl">
      <ContentRenderer post={post} viewMode="activity" />
    </View>
  );
}

function getPost(event: db.ActivityEvent): db.Post {
  let post: db.Post;
  if (event.post) {
    post = event.post;
  } else {
    // %activity gives us partials so...square peg, round hole
    post = db.buildPendingPost({
      authorId: event.authorId ?? '',
      content: (event.content as ub.Story) ?? [],
      channel: event.channel!,
    });
  }

  return post;
}
