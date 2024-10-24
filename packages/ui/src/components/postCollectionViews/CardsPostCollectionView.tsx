import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Text, View, useWindowDimensions } from 'tamagui';

import { usePostCollectionContextUnsafelyUnwrapped } from '../../contexts/postCollection';
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

    return (
      <View
        onPress={(event) => {
          if (displayedIndex != null && ctx.posts != null) {
            const delta =
              event.nativeEvent.locationY < windowDimensions.width * 0.5
                ? -1
                : 1;
            setDisplayedIndex((displayedIndex + delta) % ctx.posts.length);
          } else {
            setDisplayedIndex(null);
          }
        }}
        alignItems="stretch"
        justifyContent="center"
        flex={1}
      >
        {displayedPost == null ? (
          <Text>Loading...</Text>
        ) : (
          <ctx.PostView post={displayedPost} showAuthor />
        )}
      </View>
    );
  }
);
