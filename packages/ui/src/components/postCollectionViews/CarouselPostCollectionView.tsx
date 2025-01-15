import { JSONValue } from '@tloncorp/shared';
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Theme, View, XStack, YStack } from 'tamagui';
import { LinearGradient } from 'tamagui/linear-gradient';

import { usePostCollectionContext } from '../../contexts/postCollection';
import AuthorRow from '../AuthorRow';
import { Carousel, CarouselRef } from '../Carousel';
import { Icon } from '../Icon';
import { Text } from '../TextV2';
import { IPostCollectionView } from './shared';

function BaseCarouselPostCollection() {
  const {
    hasNewerPosts,
    hasOlderPosts,
    onScrollEndReached,
    onScrollStartReached,
    posts,
    collectionConfiguration,
    PostView,
  } = usePostCollectionContext();

  const carouselRef = useRef<CarouselRef>(null);
  const handleIndexChange = useCallback(
    (newIndex: number) => {
      if (newIndex === 0 && hasNewerPosts) {
        onScrollStartReached?.();
      }
      if (posts && newIndex === posts.length - 1 && hasOlderPosts) {
        onScrollEndReached?.();
      }
    },
    [
      hasNewerPosts,
      hasOlderPosts,
      onScrollEndReached,
      onScrollStartReached,
      posts,
    ]
  );

  const scrollDirection = useMemo(() => {
    try {
      return JSONValue.asString(
        collectionConfiguration?.scrollDirection,
        'vertical'
      ) as 'vertical' | 'horizontal';
    } catch (_) {
      // ignore
      return 'vertical';
    }
  }, [collectionConfiguration]);

  return (
    <View alignItems="stretch" justifyContent="center" flex={1}>
      <Carousel
        ref={carouselRef}
        flex={1}
        scrollDirection={scrollDirection}
        onVisibleIndexChange={handleIndexChange}
      >
        {posts?.map((post) => (
          <Carousel.Item justifyContent="center" key={post.id}>
            <XStack flex={1} backgroundColor="$background">
              <PostView post={post} showAuthor={false} showReplies={false} />
              <View
                pointerEvents="box-none"
                position={'absolute'}
                bottom={0}
                left={0}
                right={0}
              >
                <LinearGradient
                  position="absolute"
                  top={0}
                  left={0}
                  bottom={0}
                  right={0}
                  width="100%"
                  height="100%"
                  pointerEvents="none"
                  colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.5)']}
                />
                <SafeAreaView
                  edges={['bottom', 'right', 'left']}
                  style={{
                    pointerEvents: 'box-none',
                    paddingTop: 60,
                  }}
                >
                  <Theme name={'dark'}>
                    <XStack
                      alignItems="flex-end"
                      justifyContent="space-between"
                      padding="$l"
                      pointerEvents="box-none"
                    >
                      <AuthorRow
                        author={post.author}
                        authorId={post.authorId}
                        sent={post.sentAt ?? 0}
                        type={post.type}
                        deliveryStatus={post.deliveryStatus}
                        editStatus={post.editStatus}
                        deleteStatus={post.deleteStatus}
                        showEditedIndicator={!!post.isEdited}
                        showSentAt={false}
                      />
                      <YStack gap="$l">
                        <YStack alignItems="center">
                          <Icon type="Face" />
                          <Text size="$label/s">{post.reactions?.length}</Text>
                        </YStack>
                        <YStack alignItems="center">
                          <Icon type="Messages" />
                          <Text size="$label/s">{post.replyCount}</Text>
                        </YStack>
                      </YStack>
                    </XStack>
                  </Theme>
                </SafeAreaView>
              </View>
            </XStack>
          </Carousel.Item>
        ))}
      </Carousel>
    </View>
  );
}

export const CarouselPostCollection: IPostCollectionView = forwardRef(
  function CarouselPostCollection(_props, forwardedRef) {
    useImperativeHandle(forwardedRef, () => ({
      scrollToPostAtIndex(_index: number) {
        console.warn('not implemented');
      },
    }));

    return <BaseCarouselPostCollection />;
  }
);
