import * as db from '@tloncorp/shared/dist/db';
import { truncate } from 'lodash';
import { ContentReference } from 'packages/shared/dist/api';
import { PropsWithChildren, useCallback, useMemo, useState } from 'react';
import { View, XStack, styled } from 'tamagui';

import { GalleryPostAuthorRow } from '../AuthorRow';
import { ContentReferenceLoader } from '../ContentReference/ContentReference';
import { VideoEmbed } from '../Embed';
import { Icon } from '../Icon';
import { ImageWithFallback } from '../Image';
import { useBoundHandler } from '../ListItem/listItemUtils';
import {
  Block,
  ImageBlock,
  InlineLinkNode,
  VideoBlock,
  convertContent,
} from '../PostContent/contentProcessor';
import { SendPostRetrySheet } from '../SendPostRetrySheet';
import { Text } from '../TextV2';

const GalleryPostFrame = styled(View, {
  name: 'GalleryPostFrame',
  borderWidth: 1,
  borderColor: '$border',
  position: 'relative',
  borderRadius: '$m',
  maxHeight: '100%',
  overflow: 'hidden',
  flex: 1,
  backgroundColor: '$background',
  variants: {
    viewMode: {
      attachment: {
        borderRadius: 0,
      },
      activity: {},
    },
    previewType: {
      image: {
        borderWidth: 0,
      },
      video: {
        borderWidth: 0,
      },
      hidden: {},
      deleted: {},
      text: {},
      link: {
        borderWidth: 0,
        backgroundColor: '$secondaryBackground',
      },
      reference: {
        borderWidth: 0,
        backgroundColor: '$secondaryBackground',
      },
      unsupported: {
        borderWidth: 0,
        backgroundColor: '$secondaryBackground',
      },
    },
  } as const,
});

export default function GalleryPost({
  post,
  onPress,
  onLongPress,
  onPressRetry,
  onPressDelete,
  viewMode,
  isHighlighted,
}: {
  post: db.Post;
  onPress?: (post: db.Post) => void;
  onLongPress?: (post: db.Post) => void;
  onPressRetry?: (post: db.Post) => void;
  onPressDelete?: (post: db.Post) => void;
  viewMode?: 'activity' | 'attachment';
  isHighlighted?: boolean;
}) {
  const [showRetrySheet, setShowRetrySheet] = useState(false);

  const handleRetryPressed = useCallback(() => {
    onPressRetry?.(post);
    setShowRetrySheet(false);
  }, [onPressRetry, post]);

  const handleDeletePressed = useCallback(() => {
    onPressDelete?.(post);
    setShowRetrySheet(false);
  }, [onPressDelete, post]);

  const handlePress = useCallback(() => {
    post.deliveryStatus === 'failed'
      ? () => setShowRetrySheet(true)
      : onPress?.(post);
  }, [onPress, post]);

  const handleLongPress = useBoundHandler(post, onLongPress);

  const preview = usePostPreview(post);

  return (
    <GalleryPostFrame
      previewType={preview.type}
      viewMode={viewMode}
      disabled={viewMode === 'activity'}
      onPress={handlePress}
      onLongPress={handleLongPress}
    >
      <View flex={1} pointerEvents="none">
        {preview.type === 'hidden' ? (
          <ErrorPlaceholder>
            You have hidden or flagged this post.
          </ErrorPlaceholder>
        ) : preview.type === 'deleted' ? (
          <ErrorPlaceholder>This post has been deleted.</ErrorPlaceholder>
        ) : preview.type === 'image' ? (
          <ImageWithFallback
            contentFit="cover"
            flex={1}
            backgroundColor={'$secondaryBackground'}
            fallback={
              <ErrorPlaceholder>
                Failed to load {preview.image.src.slice(0, 100)}
              </ErrorPlaceholder>
            }
            source={{ uri: preview.image.src }}
          />
        ) : preview.type === 'video' ? (
          <VideoEmbed flex={1} video={preview.video} />
        ) : preview.type === 'link' ? (
          <View padding="$m" flex={1} gap="$m">
            <Icon type="Link" customSize={[24, 17]} />
            <Text size={'$label/s'} color="$secondaryText">
              {truncate(preview.link.href, { length: 100 })}
              {'\n\n'}
              {post.textContent}
            </Text>
          </View>
        ) : preview.type === 'reference' ? (
          <ContentReferenceLoader
            viewMode="block"
            reference={preview.reference}
          />
        ) : preview.type === 'text' ? (
          <View padding="$m" flex={1}>
            <Text size={'$label/s'} color="$secondaryText">
              {post.textContent}
            </Text>
          </View>
        ) : null}

        {viewMode !== 'activity' &&
          preview.type !== 'hidden' &&
          preview.type !== 'deleted' && (
            <View
              position="absolute"
              bottom={0}
              left={0}
              right={0}
              width="100%"
              pointerEvents="none"
            >
              {post.deliveryStatus === 'failed' ? (
                <XStack
                  alignItems="center"
                  paddingLeft="$xl"
                  paddingBottom="$xl"
                >
                  <Text color="$negativeActionText" size="$label/s">
                    Message failed to send
                  </Text>
                </XStack>
              ) : (
                <GalleryPostAuthorRow
                  author={post.author}
                  authorId={post.authorId}
                  sent={post.sentAt}
                  type={post.type}
                />
              )}
            </View>
          )}
        <SendPostRetrySheet
          open={showRetrySheet}
          onOpenChange={setShowRetrySheet}
          onPressDelete={handleDeletePressed}
          onPressRetry={handleRetryPressed}
        />
      </View>
    </GalleryPostFrame>
  );
}

function ErrorPlaceholder({ children }: PropsWithChildren) {
  return (
    <View
      backgroundColor={'$secondaryBackground'}
      padding="$m"
      flex={1}
      gap="$m"
    >
      <Icon type="Placeholder" customSize={[24, 17]} />
      <Text size="$label/s" color="$secondaryText">
        {children}
      </Text>
    </View>
  );
}

type BlockFromType<T extends Block['type']> = Extract<Block, { type: T }>;
type GroupedBlocks = {
  [K in Block['type']]?: BlockFromType<K>[];
};

type GalleryPostPreview =
  | {
      type: 'reference';
      reference: ContentReference;
    }
  | {
      type: 'image';
      image: ImageBlock;
    }
  | {
      type: 'video';
      video: VideoBlock;
    }
  | {
      type: 'link';
      link: InlineLinkNode;
    }
  | {
      type: 'text';
      text: string;
    }
  | { type: 'hidden' }
  | { type: 'deleted' };

function usePostPreview(post: db.Post): GalleryPostPreview {
  return useMemo(() => {
    if (post.hidden) {
      return { type: 'hidden' };
    }
    if (post.isDeleted) {
      return { type: 'deleted' };
    }
    const blocks = post.content ? convertContent(post.content) : [];
    const groupedBlocks = blocks.reduce<GroupedBlocks>((memo, b) => {
      if (!memo[b.type]) {
        memo[b.type] = [];
      }
      // type mess, better ideas?
      (memo[b.type] as BlockFromType<typeof b.type>[]).push(
        b as BlockFromType<typeof b.type>
      );
      return memo;
    }, {});

    if (groupedBlocks.reference?.length) {
      return {
        type: 'reference',
        reference: groupedBlocks.reference[0],
      };
    } else if (groupedBlocks.image?.length) {
      return {
        type: 'image',
        image: groupedBlocks.image[0],
      };
    } else if (groupedBlocks.video?.length) {
      return {
        type: 'video',
        video: groupedBlocks.video[0],
      };
    } else if (groupedBlocks.paragraph?.length) {
      for (const block of groupedBlocks.paragraph) {
        for (const inline of block.content) {
          if (inline.type === 'link') {
            return {
              type: 'link',
              link: inline,
            };
          }
        }
      }
    }
    return {
      type: 'text',
      text: post.textContent ?? '',
    };
  }, [post]);
}
