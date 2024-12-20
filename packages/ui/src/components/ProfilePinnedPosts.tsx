import { utils } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useMemo, useState } from 'react';
import { Circle, ScrollView, XStack, YStack, YStackProps } from 'tamagui';

import {
  BlockReferenceContent,
  ChatReferenceContent,
  NoteReferenceContent,
  PostReference,
  PostReferenceLoader,
  ReferenceProps,
} from './ContentReference';
import { Icon } from './Icon';
import Pressable from './Pressable';
import { Text } from './TextV2';
import { WidgetPane } from './WidgetPane';

export function PinnedPostsDisplay(props: {
  pinnedPosts: db.ContactPinnedPost[];
  isLoading: boolean;
  removable?: boolean;
  onRemove?: (postId: string) => void;
}) {
  const [isVertical, setIsVertical] = useState(true);
  if (isVertical) {
    return (
      <YStack flex={1} gap="$l">
        <Pressable onLongPress={() => setIsVertical(false)}>
          <Text
            marginTop="$2xl"
            marginBottom="$l"
            size="$label/l"
            fontWeight="500"
            textAlign="center"
          >
            Pinned Posts
          </Text>
        </Pressable>
        {props.pinnedPosts.map((pinnedPost) => {
          return (
            <PinnedPostContent
              key={pinnedPost.postId}
              postId={pinnedPost.postId}
              post={pinnedPost.post}
              removable={props.removable ?? false}
              onRemove={props.onRemove}
              _isVertical={isVertical}
            />
          );
        })}
      </YStack>
    );
  }

  return (
    <WidgetPane width="100%">
      <Pressable onLongPress={() => setIsVertical(true)}>
        <WidgetPane.Title>Pinned Posts</WidgetPane.Title>
      </Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <XStack gap="$l">
          {props.pinnedPosts.map((pinnedPost) => {
            return (
              <PinnedPostContent
                key={pinnedPost.postId}
                postId={pinnedPost.postId}
                post={pinnedPost.post}
                removable={props.removable ?? false}
                onRemove={props.onRemove}
              />
            );
          })}
        </XStack>
      </ScrollView>
    </WidgetPane>
  );
}

function PinnedPostContent(props: {
  postId: string;
  post?: db.Post | null;
  removable: boolean;
  onRemove?: (postId: string) => void;
  _isVertical?: boolean;
}) {
  const customProps: { containerProps: YStackProps; refProps: ReferenceProps } =
    props._isVertical
      ? {
          containerProps: {
            borderRadius: '$xl',
            padding: '$xl',
            width: '100%',
            minHeight: 120,
            backgroundColor: '$background',
          },
          refProps: {
            flex: 1,
            maxHeight: 400,
          },
        }
      : {
          containerProps: {
            borderRadius: '$xl',
            padding: '$xl',
            height: 300,
            aspectRatio: 1,
            backgroundColor: '$secondaryBackground',
          },
          refProps: {
            flex: 1,
            maxHeight: 400,
          },
        };

  const timeDisplay = useMemo(() => {
    const date = new Date(props.post?.sentAt ?? Date.now());
    return utils.makePrettyDay(date);
  }, [props.post?.sentAt]);

  return (
    <YStack
      flex={1}
      // padding="$xl"
      // borderRadius="$xl"
      // backgroundColor="$secondaryBackground"
      // minWidth={200}
      // maxWidth={400}
      // backgroundColor="$background"
      height="auto"
      {...customProps.containerProps}
    >
      {props.removable && (
        <XStack width="100%" justifyContent="flex-end">
          <Circle
            backgroundColor="$gray100"
            padding="$s"
            onPress={() => props.onRemove?.(props.postId)}
          >
            <Icon type="Close" size="$s" color="$primaryText" />
          </Circle>
        </XStack>
      )}
      {props.post ? (
        // <SmallContentRenderer content={content} />
        // <GalleryContentRenderer post={props.post} />
        <>
          {props.post?.type === 'block' ? (
            <BlockReferenceContent
              post={props.post}
              {...customProps.refProps}
            />
          ) : props.post?.type === 'note' ? (
            <NoteReferenceContent
              post={props.post}
              hideAuthor
              {...customProps.refProps}
            />
          ) : props.post ? (
            <ChatReferenceContent
              post={props.post}
              hideAuthor
              {...customProps.refProps}
            />
          ) : null}
        </>
      ) : (
        <Text>Post Not Found</Text>
      )}
      <XStack paddingTop="$xl">
        <Text color="$tertiaryText" size="$label/m">
          {timeDisplay}
        </Text>
      </XStack>
    </YStack>
  );
}
