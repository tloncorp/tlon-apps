import * as db from '@tloncorp/shared/dist/db';
import * as logic from '@tloncorp/shared/dist/logic';
import { useMemo } from 'react';
import { ScrollView, View } from 'tamagui';

import { GalleryPost } from '../GalleryPost';
import { NotebookPost } from '../NotebookPost';
import { PostContentRenderer } from '../PostContent';

export function ActivitySourceContent({
  summary,
  pressHandler,
}: {
  summary: logic.SourceActivityEvents;
  pressHandler?: () => void;
}) {
  const post = useMemo(() => getPost(summary.newest), [summary.newest]);
  const allPosts = useMemo(() => {
    const fullPosts =
      summary.all?.map((event) => getPost(event)).filter(Boolean) ?? []; // defensive
    const seen = new Set();
    return fullPosts.filter((item) => {
      if (seen.has(item.id)) {
        return false;
      }
      seen.add(item.id);
      return true;
    });
  }, [summary.all]);

  // thread or comment
  if (summary.newest.parentId) {
    return <PostContentRenderer post={post} />;
  }

  if (
    summary.newest.channel?.type === 'gallery' ||
    summary.newest.channel?.type === 'notebook'
  ) {
    return (
      <ScrollView
        gap="$s"
        horizontal
        alwaysBounceHorizontal={false}
        showsHorizontalScrollIndicator={false}
      >
        {summary.newest.channel?.type === 'notebook' ? (
          <>
            {allPosts.map((post) => (
              <View
                key={post.id}
                marginRight="$s"
                onPress={pressHandler}
                width={256}
              >
                <NotebookPost post={post} viewMode="activity" size="$s" />
              </View>
            ))}
          </>
        ) : (
          <>
            {allPosts.map((post) => (
              <View key={post.id} onPress={pressHandler}>
                <GalleryPost post={post} />
              </View>
            ))}
          </>
        )}
      </ScrollView>
    );
  }

  return <PostContentRenderer post={post} />;
}

function getPost(event: db.ActivityEvent): db.Post {
  let post: db.Post;
  if (event.post) {
    post = event.post;
  } else {
    // %activity gives us partials so...square peg, round hole
    post = db.assemblePostFromActivityEvent(event);
  }

  return post;
}
