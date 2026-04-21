import * as db from '@tloncorp/shared/db';
import {
  BlockData,
  BlockFromType,
  BlockType,
  PostContent,
} from '@tloncorp/shared/logic';
import { Icon, Text } from '@tloncorp/ui';
import { truncate } from 'lodash';
import { ComponentProps, PropsWithChildren, useMemo } from 'react';
import { View, styled } from 'tamagui';

import { createContentRenderer } from '../PostContent/ContentRenderer';
import { usePostContent } from '../PostContent/contentUtils';

export function GalleryContentRenderer({
  post,
  isPreview = false,
  onPressImage,
  getImageViewerId,
  size,
  ...props
}: {
  post: db.Post;
  onPressImage?: (src: string) => void;
  getImageViewerId?: (src: string) => string | undefined;
  size?: '$s' | '$l';
  isPreview?: boolean;
} & Omit<ComponentProps<typeof PreviewFrame>, 'content'>) {
  const content = usePostContent(post);
  const previewContent = usePreviewContent(content);

  // For gallery detail views of image posts, only show images
  // since CaptionContentRenderer handles text separately below
  const displayContent = useMemo(() => {
    if (!isPreview && size === '$l') {
      // Check if this is an image post
      const hasImage = content.some((block) => block.type === 'image');
      if (hasImage) {
        // For image posts, only show images in main content area
        // Caption text will be handled by CaptionContentRenderer below
        return content.filter((block) => block.type === 'image');
      }
    }
    // For non-image posts and previews, use appropriate content
    return isPreview ? previewContent : content;
  }, [content, previewContent, isPreview, size]);

  if (post.hidden) {
    return (
      <ErrorPlaceholder>You have hidden or reported this post</ErrorPlaceholder>
    );
  } else if (post.isDeleted) {
    return <ErrorPlaceholder>This post has been deleted</ErrorPlaceholder>;
  }

  return size === '$l' ? (
    <LargePreview
      content={displayContent}
      onPressImage={onPressImage}
      getImageViewerId={getImageViewerId}
      {...props}
    />
  ) : (
    <SmallPreview
      content={displayContent}
      onPressImage={onPressImage}
      getImageViewerId={getImageViewerId}
      {...props}
    />
  );
}

type GalleryPreviewProps = {
  content: PostContent;
  onPressImage?: (src: string) => void;
  getImageViewerId?: (src: string) => string | undefined;
} & Omit<ComponentProps<typeof PreviewFrame>, 'content'>;

function LargePreview({
  content,
  onPressImage,
  getImageViewerId,
  ...props
}: GalleryPreviewProps) {
  return (
    <PreviewFrame {...props} previewType={content[0]?.type ?? 'unsupported'}>
      <LargeContentRenderer
        content={content}
        onPressImage={onPressImage}
        getImageViewerId={getImageViewerId}
      />
    </PreviewFrame>
  );
}

function SmallPreview({
  content,
  onPressImage,
  getImageViewerId,
  ...props
}: GalleryPreviewProps) {
  const link = useBlockLink(content);

  return link ? (
    <PreviewFrame {...props} previewType="link">
      <LinkPreview link={link} />
    </PreviewFrame>
  ) : (
    <PreviewFrame {...props} previewType={content[0]?.type ?? 'unsupported'}>
      <SmallContentRenderer
        height={'100%'}
        content={content}
        onPressImage={onPressImage}
        getImageViewerId={getImageViewerId}
      />
    </PreviewFrame>
  );
}

const PreviewFrame = styled(View, {
  name: 'PostPreviewFrame',
  flex: 1,
  borderColor: '$border',
  borderRadius: 0,
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
    previewType: (type: BlockType, config: { props: { embedded?: true } }) => {
      if (config.props.embedded) {
        return {};
      }
      switch (type) {
        case 'reference':
          return {
            backgroundColor: '$secondaryBackground',
          };
        case 'blockquote':
          return { paddingTop: '$3xl' };
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

const LargeContentRenderer = createContentRenderer({
  blockSettings: {
    blockWrapper: {
      padding: '$2xl',
    },
    image: {
      ...noWrapperPadding,
      imageProps: { borderRadius: 0 },
    },
    video: {
      borderRadius: 0,
      alignSelf: 'stretch',
      wrapperProps: {
        padding: 0,
        width: '100%',
        alignItems: 'stretch',
      },
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
    link: {
      ...noWrapperPadding,
      minHeight: 300,
      imageProps: {
        aspectRatio: 1.5,
      },
    },
    file: {
      fullbleed: false,
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
      trimmed: false,
    },
    image: {
      height: '100%',
      borderRadius: 0,
      imageProps: {
        aspectRatio: 'unset',
        height: '100%',
        contentFit: 'cover',
        borderRadius: 0,
      },
      ...noWrapperPadding,
    },
    video: {
      height: '100%',
      borderRadius: 0,
      contentFit: 'cover',
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
    link: {
      borderRadius: 0,
      borderWidth: 0,
      renderDescription: true,
      imageProps: {
        height: '66%',
        aspectRatio: 'unset',
      },
      ...noWrapperPadding,
    },
    file: {
      fullbleed: true,
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
    } else if (groupedBlocks.link?.length) {
      return [groupedBlocks.link[0]];
    }

    // For previewable first blocks (image/video/reference), show just that
    if (firstBlockIsPreviewable(content)) {
      return content.slice(0, 1);
    }

    // For text-only content, check if it's all text blocks
    const isTextContent = content.every(
      (block) => !['image', 'video', 'reference', 'link'].includes(block.type)
    );

    if (isTextContent) {
      // Limit to first 2 blocks to prevent overflow in preview
      return content.slice(0, 2);
    }

    return content;
  }, [content]);
}

function firstBlockIsPreviewable(content: BlockData[]): boolean {
  return (
    content.length > 0 &&
    ['image', 'video', 'reference', 'file'].includes(content[0].type)
  );
}
