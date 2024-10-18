import { makePrettyShortDate } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/dist/db';
import { truncate } from 'lodash';
import { ComponentProps, useCallback, useMemo, useState } from 'react';
import { PropsWithChildren } from 'react';
import { View, XStack, styled } from 'tamagui';

import { DetailViewAuthorRow } from '../AuthorRow';
import { ContactAvatar } from '../Avatar';
import { Icon } from '../Icon';
import { useBoundHandler } from '../ListItem/listItemUtils';
import { createContentRenderer } from '../PostContent/ContentRenderer';
import {
  BlockData,
  BlockFromType,
  BlockType,
  PostContent,
  usePostContent,
} from '../PostContent/contentUtils';
import { SendPostRetrySheet } from '../SendPostRetrySheet';
import { Text } from '../TextV2';

const GalleryPostFrame = styled(View, {
  name: 'GalleryPostFrame',
  maxHeight: '100%',
  overflow: 'hidden',
  aspectRatio: 1,
});

export function GalleryPost({
  post,
  onPress,
  onLongPress,
  onPressRetry,
  onPressDelete,
  showAuthor = true,
  ...props
}: {
  post: db.Post;
  onPress?: (post: db.Post) => void;
  onLongPress?: (post: db.Post) => void;
  onPressRetry?: (post: db.Post) => void;
  onPressDelete?: (post: db.Post) => void;
  showAuthor?: boolean;
  isHighlighted?: boolean;
} & Omit<ComponentProps<typeof GalleryPostFrame>, 'onPress' | 'onLongPress'>) {
  const [showRetrySheet, setShowRetrySheet] = useState(false);

  const handleRetryPressed = useCallback(() => {
    onPressRetry?.(post);
    setShowRetrySheet(false);
  }, [onPressRetry, post]);

  const handleDeletePressed = useCallback(() => {
    onPressDelete?.(post);
    setShowRetrySheet(false);
  }, [onPressDelete, post]);

  const deliveryFailed =
    post.deliveryStatus === 'failed' ||
    post.editStatus === 'failed' ||
    post.deleteStatus === 'failed';

  const handlePress = useCallback(() => {
    if (onPress && !deliveryFailed) {
      onPress(post);
    } else if (deliveryFailed) {
      setShowRetrySheet(true);
    }
  }, [onPress, deliveryFailed, post]);

  const handleLongPress = useBoundHandler(post, onLongPress);

  if (post.isDeleted) {
    return null;
  }

  return (
    <GalleryPostFrame
      onPress={handlePress}
      onLongPress={handleLongPress}
      {...props}
    >
      <GalleryContentRenderer post={post} pointerEvents="none" size="$s" />
      {showAuthor && !post.hidden && !post.isDeleted && (
        <View
          position="absolute"
          bottom={0}
          left={0}
          right={0}
          width="100%"
          pointerEvents="none"
        >
          <XStack alignItems="center" gap="$xl" padding="$m" {...props}>
            <ContactAvatar size="$2xl" contactId={post.authorId} />
            {deliveryFailed && (
              <Text
                // applying some shadow here because we could be rendering it
                // on top of an image
                shadowOffset={{
                  width: 0,
                  height: 1,
                }}
                shadowOpacity={0.8}
                shadowColor="$redSoft"
                color="$negativeActionText"
                size="$label/s"
              >
                Tap to retry
              </Text>
            )}
          </XStack>
        </View>
      )}
      <SendPostRetrySheet
        open={showRetrySheet}
        onOpenChange={setShowRetrySheet}
        post={post}
        onPressDelete={handleDeletePressed}
        onPressRetry={handleRetryPressed}
      />
    </GalleryPostFrame>
  );
}

export function GalleryPostDetailView({ post }: { post: db.Post }) {
  const formattedDate = useMemo(() => {
    return makePrettyShortDate(new Date(post.receivedAt));
  }, [post.receivedAt]);
  const content = usePostContent(post);
  const isImagePost = content.some((block) => block.type === 'image');

  return (
    <View paddingBottom="$xs" borderBottomWidth={1} borderColor="$border">
      <View borderTopWidth={1} borderBottomWidth={1} borderColor="$border">
        <GalleryContentRenderer embedded post={post} size="$l" />
      </View>

      <View gap="$2xl" padding="$xl">
        <DetailViewAuthorRow authorId={post.authorId} color="$primaryText" />

        {post.title && <Text size="$body">{post.title}</Text>}

        <Text size="$body" color="$tertiaryText">
          Added {formattedDate}
        </Text>

        {isImagePost && <CaptionContentRenderer content={content} />}
      </View>
    </View>
  );
}

export function GalleryContentRenderer({
  post,
  ...props
}: {
  post: db.Post;
  size?: '$s' | '$l';
} & Omit<ComponentProps<typeof PreviewFrame>, 'content'>) {
  const content = usePostContent(post);
  const previewContent = usePreviewContent(content);

  if (post.hidden) {
    return (
      <ErrorPlaceholder>You have hidden or flagged this post</ErrorPlaceholder>
    );
  } else if (post.isDeleted) {
    return <ErrorPlaceholder>This post has been deleted</ErrorPlaceholder>;
  }

  return props.size === '$l' ? (
    <LargePreview content={previewContent} {...props} />
  ) : (
    <SmallPreview content={previewContent} {...props} />
  );
}

function LargePreview({
  content,
  ...props
}: { content: PostContent } & Omit<
  ComponentProps<typeof PreviewFrame>,
  'content'
>) {
  return (
    <PreviewFrame {...props} previewType={content[0]?.type ?? 'unsupported'}>
      <LargeContentRenderer content={content.slice(0, 1)} />
    </PreviewFrame>
  );
}

function SmallPreview({
  content,
  ...props
}: { content: PostContent } & Omit<
  ComponentProps<typeof PreviewFrame>,
  'content'
>) {
  const link = useBlockLink(content);

  return link ? (
    <PreviewFrame {...props} previewType="link">
      <LinkPreview link={link} />
    </PreviewFrame>
  ) : (
    <PreviewFrame {...props} previewType={content[0]?.type ?? 'unsupported'}>
      <SmallContentRenderer height={'100%'} content={content.slice(0, 1)} />
    </PreviewFrame>
  );
}

const PreviewFrame = styled(View, {
  name: 'PostPreviewFrame',
  flex: 1,
  borderColor: '$border',
  borderRadius: '$m',
  backgroundColor: '$background',
  overflow: 'hidden',
  variants: {
    embedded: {
      true: {
        borderWidth: 0,
        borderRadius: 0,
        backgroundColor: 'transparent',
      },
    },
    previewType: (
      type: BlockType | 'link',
      config: { props: { embedded?: true } }
    ) => {
      if (config.props.embedded) {
        return {};
      }
      switch (type) {
        case 'reference':
          return { backgroundColor: '$secondaryBackground' };
        case 'paragraph':
        case 'list':
        case 'blockquote':
          return { borderWidth: 1 };
      }
    },
  } as const,
});

function LinkPreview({ link }: { link: { href: string; text?: string } }) {
  const truncatedHref = useMemo(() => {
    return truncate(link?.href ?? '', { length: 100 });
  }, [link?.href]);
  return (
    <View
      flex={1}
      backgroundColor={'$secondaryBackground'}
      padding="$l"
      gap="$xl"
      borderRadius="$m"
    >
      <Icon type="Link" customSize={[17, 17]} />
      <Text size={'$label/s'} color="$secondaryText">
        {link.href !== link.text && link.text && link.text !== ' '
          ? `${link.text}\n\n${truncatedHref}`
          : truncatedHref}
      </Text>
    </View>
  );
}

function useBlockLink(
  content: BlockData[]
): { text: string; href: string } | null {
  return useMemo(() => {
    if (content[0]?.type !== 'paragraph') {
      return null;
    }
    for (const inline of content[0].content) {
      if (inline.type === 'link') {
        return inline;
      }
    }
    return null;
  }, [content]);
}

const noWrapperPadding = {
  wrapperProps: {
    padding: 0,
  },
} as const;

const CaptionContentRenderer = createContentRenderer({
  blockSettings: {
    paragraph: {
      size: '$body',
      ...noWrapperPadding,
    },
    image: {
      display: 'none',
    },
  },
});

const LargeContentRenderer = createContentRenderer({
  blockSettings: {
    blockWrapper: {
      padding: '$2xl',
    },
    image: {
      borderRadius: 0,
      ...noWrapperPadding,
    },
    video: {
      borderRadius: 0,
      ...noWrapperPadding,
    },
    code: {
      borderRadius: 0,
      borderWidth: 0,
      ...noWrapperPadding,
    },
    reference: {
      borderRadius: 0,
      borderWidth: 0,
      contentSize: '$l',
      height: '100%',
      ...noWrapperPadding,
    },
  },
});

const SmallContentRenderer = createContentRenderer({
  blockSettings: {
    blockWrapper: {
      padding: '$l',
      flex: 1,
    },
    lineText: {
      size: '$label/s',
    },
    image: {
      height: '100%',
      imageProps: { aspectRatio: 'unset', height: '100%' },
      ...noWrapperPadding,
    },
    video: {
      height: '100%',
      ...noWrapperPadding,
    },
    reference: {
      contentSize: '$s',
      borderRadius: 0,
      borderWidth: 0,
      ...noWrapperPadding,
    },
    code: {
      borderWidth: 0,
      contentSize: '$s',
      textProps: { size: '$mono/s' },
      ...noWrapperPadding,
    },
  },
});

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

type GroupedBlocks = {
  [K in BlockType]?: BlockFromType<K>[];
};

function usePreviewContent(content: BlockData[]): BlockData[] {
  return useMemo(() => {
    const groupedBlocks = content.reduce((memo, b) => {
      if (!memo[b.type]) {
        memo[b.type] = [];
      }
      // type mess, better ideas?
      (memo[b.type] as BlockFromType<typeof b.type>[]).push(
        b as BlockFromType<typeof b.type>
      );
      return memo;
    }, {} as GroupedBlocks);

    if (groupedBlocks.reference?.length) {
      return [groupedBlocks.reference[0]];
    } else if (groupedBlocks.image?.length) {
      return [groupedBlocks.image[0]];
    } else if (groupedBlocks.video?.length) {
      return [groupedBlocks.video[0]];
    }
    return content;
  }, [content]);
}
