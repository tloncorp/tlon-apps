import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import { Text, View, useWindowDimensions } from 'tamagui';

import { usePostCollectionContextUnsafelyUnwrapped } from '../../contexts/postCollection';
import { Button } from '../Button';
import { IPostCollectionView } from './shared';

function BaseCardsPostCollection({
  disableNavigation = false,
}: {
  disableNavigation?: boolean;
}) {
  const {
    hasNewerPosts,
    hasOlderPosts,
    onScrollEndReached,
    onScrollStartReached,
    posts,
    PostView,
  } = usePostCollectionContextUnsafelyUnwrapped();
  const windowDimensions = useWindowDimensions();
  const [displayedIndex, setDisplayedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (posts && displayedIndex == null) {
      setDisplayedIndex(0);
    }

    if (posts && displayedIndex != null && displayedIndex > posts.length) {
      setDisplayedIndex(posts.length - 1);
    }
  }, [posts, displayedIndex]);

  const displayedPost = posts?.[displayedIndex ?? 0];

  useEffect(() => {
    if (displayedIndex === 0 && hasNewerPosts) {
      onScrollStartReached?.();
    }
    if (posts && displayedIndex === posts.length - 1 && hasOlderPosts) {
      onScrollEndReached?.();
    }
  }, [
    disableNavigation,
    displayedIndex,
    hasNewerPosts,
    hasOlderPosts,
    onScrollEndReached,
    onScrollStartReached,
    posts,
  ]);

  const jog = useCallback(
    (delta: number) => {
      if (displayedIndex != null && posts != null && posts.length > 0) {
        const postsCount = posts.length;
        setDisplayedIndex((prev) => {
          if (prev == null) {
            return 0;
          }
          let next = (prev + delta) % postsCount;
          while (next < 0) {
            next += postsCount;
          }
          return next;
        });
      } else {
        setDisplayedIndex(null);
      }
    },
    [posts, displayedIndex]
  );

  return (
    <View
      onPress={
        disableNavigation
          ? undefined
          : (event) => {
              jog(
                event.nativeEvent.locationX < windowDimensions.width * 0.5
                  ? -1
                  : 1
              );
            }
      }
      alignItems="stretch"
      justifyContent="center"
      flex={1}
    >
      <View flex={1} alignItems="stretch" justifyContent="center">
        {displayedPost == null ? (
          <Text>Loading...</Text>
        ) : (
          <PostView post={displayedPost} showAuthor />
        )}
      </View>
      {disableNavigation || posts == null ? null : (
        <View
          alignSelf="center"
          padding="$l"
          flexDirection="row"
          alignItems="center"
          gap="$l"
        >
          <Button onPress={() => jog(-1)}>
            <Text>Previous</Text>
          </Button>
          <Text>
            {(displayedIndex ?? 0) + 1} / {posts.length}
          </Text>
          <Button onPress={() => jog(1)}>
            <Button.Text>Next</Button.Text>
          </Button>
        </View>
      )}
    </View>
  );
}

export const CardsPostCollection: IPostCollectionView = forwardRef(
  function CardsPostCollection(_props, forwardedRef) {
    useImperativeHandle(forwardedRef, () => ({
      scrollToPostAtIndex(_index: number) {
        console.warn('not implemented');
      },
    }));

    return <BaseCardsPostCollection />;
  }
);

export const SingleCardPostCollection: IPostCollectionView = forwardRef(
  function CardsPostCollection(_props, forwardedRef) {
    useImperativeHandle(forwardedRef, () => ({
      scrollToPostAtIndex(_index: number) {
        console.warn('not implemented');
      },
    }));

    return <BaseCardsPostCollection disableNavigation />;
  }
);
