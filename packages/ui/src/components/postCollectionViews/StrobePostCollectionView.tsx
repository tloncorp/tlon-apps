import * as db from '@tloncorp/shared/dist/db';
import { shuffle } from 'lodash';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { View } from 'tamagui';

import { usePostCollectionContextUnsafelyUnwrapped } from '../../contexts/postCollection';
import { IPostCollectionView } from './shared';
import { useLoadPostsInWindow } from './useLoadPostsInWindow';

function _StrobePostCollectionView({
  strobeDurationMs = 80,
  isPostInsideWindow = (p) => p.sentAt > Date.now() - 48 * 60 * 60 * 1000,
}: {
  strobeDurationMs?: number;
  isPostInsideWindow?: (post: db.Post) => boolean;
}) {
  const { posts, PostView } = usePostCollectionContextUnsafelyUnwrapped();

  useLoadPostsInWindow(isPostInsideWindow);

  // most recent (currently-showing) first
  const [displayedIndex, setDisplayedIndex] = useState<number | null>(null);
  const [pickFrom, setPickFrom] = useState<Generator<number> | null>(null);

  const reset = useCallback(() => {
    setPickFrom(posts ? bag(posts.map((_, i) => i)) : null);
  }, [posts]);

  // start once ready
  useEffect(() => {
    setDisplayedIndex((prev) => {
      if (!posts?.length) {
        return null;
      }
      if (posts?.length && prev == null) {
        return 0;
      }
      return prev;
    });
  }, [posts]);

  useInterval(
    () => {
      if (pickFrom == null) {
        return;
      }
      const next = pickFrom.next();
      if (next.done) {
        reset();
      } else {
        setDisplayedIndex(next.value);
      }
    },
    strobeDurationMs,
    displayedIndex != null
  );

  useEffect(() => {
    if (pickFrom == null && posts?.length) {
      reset();
    }
  }, [pickFrom, posts, reset]);

  return (
    <View flex={1} justifyContent="center" alignItems="flex-start">
      {posts?.map((post, i) => (
        <View
          key={post.id}
          display={i === displayedIndex ? 'contents' : 'none'}
        >
          <PostView post={post} showAuthor />
        </View>
      ))}
    </View>
  );
}

export const StrobePostCollectionView: IPostCollectionView = forwardRef(
  function StrobePostCollectionView(_props, forwardedRef) {
    useImperativeHandle(forwardedRef, () => ({
      scrollToPostAtIndex(_index: number) {
        console.warn('not implemented');
      },
    }));

    return <_StrobePostCollectionView />;
  }
);

function useInterval(
  fn: (() => void) | null,
  intervalMs: number,
  enabled = true
) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handle = setInterval(() => {
      fnRef.current?.();
    }, intervalMs);
    return () => clearInterval(handle);
  }, [fnRef, intervalMs, enabled]);
}

function* bag<T>(xs: T[]) {
  const items = [...xs];
  shuffle(items);
  while (items.length > 0) {
    yield items.pop()!;
  }
  return;
}
