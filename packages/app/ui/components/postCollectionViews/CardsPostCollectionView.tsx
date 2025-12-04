import { Button } from '@tloncorp/ui';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import { Alert } from 'react-native';
import { Text, View } from 'tamagui';

import { usePostCollectionContext } from '../../contexts/postCollection';
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
  } = usePostCollectionContext();
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
          return Math.max(0, Math.min(postsCount, prev + delta));
        });
      } else {
        setDisplayedIndex(null);
      }
    },
    [posts, displayedIndex]
  );

  return (
    <View alignItems="stretch" justifyContent="center" flex={1}>
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
          <Button fill="outline" type="primary" onPress={() => jog(1)} label="Older" />
          <Button
            fill="outline"
            type="primary"
            onPress={() => {
              Alert.prompt(
                'Go to post',
                'Lower is newer, starting at 1',
                (value) => {
                  try {
                    const index = parseInt(value, 10);
                    if (index >= 1 && index <= posts.length) {
                      setDisplayedIndex(index - 1);
                    }
                  } catch (err) {
                    console.error(err);
                  }
                }
              );
            }}
            label={`${(displayedIndex ?? 0) + 1} / ${posts.length}`}
          />
          <Button fill="outline" type="primary" onPress={() => jog(-1)} label="Newer" />
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
