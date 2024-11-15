import { useNavigation } from '@react-navigation/native';
import * as db from '@tloncorp/shared/db';
import { forwardRef, useEffect, useMemo } from 'react';
import { FlatList } from 'react-native';
import { View, getTokenValue } from 'tamagui';

import { useLivePost } from '../../contexts';
import { usePostCollectionContextUnsafelyUnwrapped } from '../../contexts/postCollection';
import { ForwardingProps } from '../../utils/react';
import { ListItem } from '../ListItem';
import Pressable from '../Pressable';
import { IPostCollectionView } from './shared';

export interface SummaryCollectionView$Item {
  key: string;
  title?: string;
  subtitle?: string;
  authorId?: string;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace SummaryCollectionView$Item {
  export function fromPost(post: db.Post): SummaryCollectionView$Item {
    return {
      key: post.id,
      authorId: post.authorId,
      ...(post.title
        ? {
            title: post.title,
            subtitle: post.textContent ?? undefined,
          }
        : {
            title: post.textContent ?? undefined,
          }),
    };
  }
}

export function BaseSummaryCollectionView({
  items,
  onPressItem,
  ...forwardedProps
}: ForwardingProps<
  typeof View,
  {
    items: db.Post[];
    onPressItem?: (post: db.Post, index: number) => void;
  }
>) {
  return (
    <View {...forwardedProps}>
      <FlatList
        data={items}
        renderItem={({ item, index }) => (
          <PostSummary
            item={item}
            onPress={() => {
              onPressItem?.(item, index);
            }}
          />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: getTokenValue('$space.xl'),
        }}
      />
    </View>
  );
}

function PostSummary({
  item,
  onPress,
}: {
  item: db.Post;
  onPress?: () => void;
}) {
  const livePost = useLivePost(item);

  const { title, subtitle, authorId } = useMemo(
    () => SummaryCollectionView$Item.fromPost(livePost),
    [livePost]
  );
  return (
    <Pressable onPress={onPress} borderRadius="$xl">
      <ListItem>
        <ListItem.MainContent>
          <ListItem.Title opacity={title == null ? 0.5 : 1} fontWeight={'500'}>
            {title ?? 'No title'}
          </ListItem.Title>
          {subtitle && <ListItem.Subtitle>{subtitle}</ListItem.Subtitle>}
        </ListItem.MainContent>
        <ListItem.EndContent>
          {authorId && (
            <ListItem.ContactIcon contactId={authorId} size="$2xl" />
          )}
        </ListItem.EndContent>
      </ListItem>
    </Pressable>
  );
}

export const PostSummaryCollectionView: IPostCollectionView = forwardRef(
  function PostSummaryCollectionView(_props, _ref) {
    return <BasePostSummaryCollectionView />;
  }
);
export function BasePostSummaryCollectionView({
  ...forwardedProps
}: ForwardingProps<
  typeof BaseSummaryCollectionView,
  Record<string, never>,
  'items'
>) {
  const { posts, hasNewerPosts, onScrollStartReached } =
    usePostCollectionContextUnsafelyUnwrapped();

  const navigation = useNavigation();

  useEffect(() => {
    if (hasNewerPosts) {
      onScrollStartReached?.();
    }
  }, [hasNewerPosts, onScrollStartReached]);

  return (
    <>
      <BaseSummaryCollectionView
        {...forwardedProps}
        items={posts ?? []}
        onPressItem={(_item, index) => {
          const post = posts?.[index];
          if (post) {
            // @ts-expect-error implicit dependency on RootStackParamList, which is in `app`
            navigation.navigate('PostUsingContentConfiguration', {
              postId: post.id,
              channelId: post.channelId,
            });
          }
        }}
      />
    </>
  );
}
