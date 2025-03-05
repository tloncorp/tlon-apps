import * as db from '@tloncorp/shared/db';
import { shuffle } from 'lodash';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { FlatList } from 'react-native';

import { usePostCollectionContext } from '../../contexts/postCollection';
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
  const { posts, PostView } = usePostCollectionContext();
  const comparator = useMemo(() => randomStableLexiSort(), []);

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
        comparator(userA, userB)
      ),
    [authorToMostRecentPost, comparator]
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

// it'd stink to show up below the bottom of the screen in every chat because
// your name is at the end of the alphabet
// here's a random but stable sort
// there's probably a better way to do this
function randomStableLexiSort(): (a: string, b: string) => number {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const cipher = shuffle(alphabet).reduce(
    (acc, letter, i) => {
      acc[letter] = alphabet[i];
      return acc;
    },
    {} as Record<string, string>
  );
  const ciphered = (str: string) =>
    str
      .split('')
      .map((c) => cipher[c] ?? ' ')
      .join('');
  return (a, b) => ciphered(a).localeCompare(ciphered(b));
}
