import * as db from '@tloncorp/shared/dist/db';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { FlatList } from 'react-native';

import { usePostCollectionContextUnsafelyUnwrapped } from '../../contexts/postCollection';
import { IPostCollectionView } from './shared';
import { useLoadPostsInWindow } from './useLoadPostsInWindow';

function _BoardroomPostCollectionView({
  isPostInsideWindow,
}: {
  /**
   * This view only looks at a contiguous window of posts, ordered by
   * `sentAt`. This function returns true if the post is outside of that window.
   *
   * e.g. To only include posts within the last 24 hours:
   * ```ts
   * isPostInsideWindow: (post: db.Post) => post.sentAt > Date.now() - 24 * 60 * 60 * 1000
   * ```
   */
  isPostInsideWindow: (post: db.Post) => boolean;
}) {
  const { posts, PostView } = usePostCollectionContextUnsafelyUnwrapped();

  const [authorToMostRecentPost, setAuthorToMostRecentPost] = useState<
    Record<string, db.Post>
  >({});

  useEffect(() => {
    if (posts == null) {
      setAuthorToMostRecentPost({});
      return;
    }

    // we go through all posts in the window each time
    // its a demo
    setAuthorToMostRecentPost((prev) => {
      let didChange = false;
      const next = { ...prev };
      for (let i = 0; i < posts.length; i++) {
        const post = posts[i];
        if (
          next[post.authorId] == null ||
          next[post.authorId].sentAt < post.sentAt
        ) {
          next[post.authorId] = post;
          didChange = true;
        }
      }
      return didChange ? next : prev;
    });
  }, [posts]);

  const items = useMemo(
    () =>
      Object.entries(authorToMostRecentPost).sort(([userA], [userB]) =>
        userA.localeCompare(userB)
      ),
    [authorToMostRecentPost]
  );

  useLoadPostsInWindow(isPostInsideWindow);

  return (
    <FlatList
      data={items}
      renderItem={({ item }) => <PostView post={item[1]} showAuthor />}
    />
  );
}

export const BoardroomPostCollectionView: IPostCollectionView = forwardRef(
  function BoardroomPostCollectionView(_props, forwardedRef) {
    useImperativeHandle(forwardedRef, () => ({
      scrollToPostAtIndex(_index: number) {
        console.warn('not implemented');
      },
    }));

    return (
      <_BoardroomPostCollectionView
        isPostInsideWindow={useCallback((post) => {
          return post.sentAt > Date.now() - 24 * 60 * 60 * 1000;
        }, [])}
      />
    );
  }
);
