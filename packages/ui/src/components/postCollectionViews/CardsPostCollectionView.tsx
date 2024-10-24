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

export const CardsPostCollection: IPostCollectionView = forwardRef(
  function CardsPostCollection(_props, forwardedRef) {
    const ctx = usePostCollectionContextUnsafelyUnwrapped();
    useImperativeHandle(forwardedRef, () => ({
      scrollToPostAtIndex(_index: number) {
        console.warn('not implemented');
      },
    }));

    const [displayedIndex, setDisplayedIndex] = useState<number | null>(null);

    useEffect(() => {
      if (ctx.posts && displayedIndex == null) {
        setDisplayedIndex(0);
      }

      if (
        ctx.posts &&
        displayedIndex != null &&
        displayedIndex > ctx.posts.length
      ) {
        setDisplayedIndex(ctx.posts.length - 1);
      }
    }, [ctx.posts, displayedIndex]);

    const displayedPost = ctx.posts?.[displayedIndex ?? 0];

    const windowDimensions = useWindowDimensions();

    useEffect(() => {
      if (displayedIndex === 0 && ctx.hasOlderPosts) {
        ctx.onScrollEndReached?.();
      }
      if (
        ctx.posts &&
        displayedIndex === ctx.posts.length - 1 &&
        ctx.hasNewerPosts
      ) {
        ctx.onScrollStartReached?.();
      }
    }, [ctx, displayedIndex]);

    const jog = useCallback(
      (delta: number) => {
        if (
          displayedIndex != null &&
          ctx.posts != null &&
          ctx.posts.length > 0
        ) {
          const postsCount = ctx.posts.length;
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
      [ctx.posts, displayedIndex]
    );

    return (
      <View
        onPress={(event) => {
          jog(
            event.nativeEvent.locationX < windowDimensions.width * 0.5 ? -1 : 1
          );
        }}
        alignItems="stretch"
        justifyContent="center"
        flex={1}
      >
        <View flex={1} alignItems="stretch" justifyContent="center">
          {displayedPost == null ? (
            <Text>Loading...</Text>
          ) : (
            <ctx.PostView post={displayedPost} showAuthor />
          )}
        </View>
        {ctx.posts == null ? null : (
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
              {(displayedIndex ?? 0) + 1} / {ctx.posts.length}
            </Text>
            <Button onPress={() => jog(1)}>
              <Button.Text>Next</Button.Text>
            </Button>
          </View>
        )}
      </View>
    );
  }
);
