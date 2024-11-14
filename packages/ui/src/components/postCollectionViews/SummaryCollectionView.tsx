import * as db from '@tloncorp/shared/db';
import {
  ComponentPropsWithRef,
  ElementType,
  forwardRef,
  useState,
} from 'react';
import { FlatList, Modal } from 'react-native';
import { View, getTokenValue } from 'tamagui';
import { YStack } from 'tamagui';

import { usePostCollectionContextUnsafelyUnwrapped } from '../../contexts/postCollection';
import { ChannelHeader } from '../Channel/ChannelHeader';
import { ListItem } from '../ListItem';
import Pressable from '../Pressable';
import { IPostCollectionView } from './shared';

type ForwardingProps<
  E extends ElementType,
  CustomProps extends Record<string, unknown>,
  OmitKeys extends keyof ComponentPropsWithRef<E> = never,
> = CustomProps & Omit<ComponentPropsWithRef<E>, keyof CustomProps | OmitKeys>;

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
    items: SummaryCollectionView$Item[];
    onPressItem?: (item: SummaryCollectionView$Item, index: number) => void;
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
        keyExtractor={(item) => item.key}
        contentContainerStyle={{
          paddingHorizontal: getTokenValue('$space.xl'),
        }}
      />
    </View>
  );
}

function PostSummary({
  item: { title, subtitle, authorId },
  onPress,
}: {
  item: SummaryCollectionView$Item;
  onPress?: () => void;
}) {
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
  'items' | 'onPressItem'
>) {
  const { posts } = usePostCollectionContextUnsafelyUnwrapped();
  const [focusedPost, setFocusedPost] = useState<db.Post | null>(null);

  return (
    <>
      <BaseSummaryCollectionView
        {...forwardedProps}
        items={posts?.map(SummaryCollectionView$Item.fromPost) ?? []}
        onPressItem={(item) => {
          setFocusedPost(posts?.find((post) => post.id === item.key) ?? null);
        }}
      />
      <Modal visible={focusedPost != null} animationType="slide">
        <DetailPostView
          post={focusedPost!}
          navigateBack={() => setFocusedPost(null)}
        />
      </Modal>
    </>
  );
}

function DetailPostView({
  post,
  navigateBack,
  ...forwardedProps
}: ForwardingProps<
  typeof YStack,
  { post: db.Post; navigateBack?: () => void },
  'backgroundColor'
>) {
  const { PostView, channel } = usePostCollectionContextUnsafelyUnwrapped();
  // use boolean coercion to also check if post.title is empty string
  const title = post.title ? post.title : 'Post';
  return (
    <YStack backgroundColor={'$background'} {...forwardedProps}>
      <ChannelHeader
        channel={channel}
        group={channel.group}
        title={title}
        goBack={navigateBack}
        showSearchButton={false}
        // showSpinner={isLoadingPosts}
        post={post}
        mode="default"
      />
      <PostView post={post} />
    </YStack>
  );
}
