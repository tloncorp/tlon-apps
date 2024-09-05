import * as db from '@tloncorp/shared/dist/db';
import { truncate } from 'lodash';
import { ComponentProps, PropsWithChildren, useMemo } from 'react';
import { View, ViewStyle, styled } from 'tamagui';

import { Icon } from '../Icon';
import {
  BlockWrapper,
  CodeBlock,
  ImageBlock,
  LineText,
  ReferenceBlock,
  VideoBlock,
} from '../PostContent/BlockRenderer';
import { ContentRenderer } from '../PostContent/ContentRenderer';
import {
  BlockData,
  BlockFromType,
  BlockType,
  ImageBlockData,
  PostContent,
  usePostContent,
} from '../PostContent/contentUtils';
import { Text } from '../TextV2';

const PreviewFrame = styled(View, {
  name: 'PostPreviewFrame',
  borderWidth: 1,
  borderColor: '$border',
  borderRadius: '$m',
  backgroundColor: '$background',
  overflow: 'hidden',
  flex: 1,
  variants: {
    embedded: {
      true: {
        borderWidth: 0,
        borderRadius: 0,
        backgroundColor: 'transparent',
      },
    },
    previewType: {
      image: {
        borderWidth: 0,
      },
      video: {
        borderWidth: 0,
      },
      reference: {
        borderWidth: 0,
        backgroundColor: '$secondaryBackground',
      },
      code: {
        borderWidth: 0,
      },
    } as Partial<Record<BlockType, ViewStyle>>,
  } as const,
});

type PreviewProps = {
  size?: '$s' | '$l';
} & Omit<ComponentProps<typeof PreviewFrame>, 'content'>;

export function GalleryPostContentRenderer({
  post,
  ...props
}: {
  post: db.Post;
} & PreviewProps) {
  const content = usePostContent(post);

  return (
    <GalleryContentRenderer
      content={content}
      isHidden={!!post.hidden}
      isDeleted={!!post.isDeleted}
      {...props}
    />
  );
}

export function GalleryContentRenderer({
  content,
  size,
  isHidden,
  isDeleted,
  ...props
}: {
  content: PostContent;
  isHidden?: boolean;
  isDeleted?: boolean;
} & PreviewProps) {
  const previewContent = usePreviewContent(content);

  if (isHidden) {
    return (
      <ErrorPlaceholder>You have hidden or flagged this post</ErrorPlaceholder>
    );
  } else if (isDeleted) {
    return <ErrorPlaceholder>This post has been deleted</ErrorPlaceholder>;
  }
  return (
    <PreviewFrame
      previewType={previewContent[0]?.type ?? 'unsupported'}
      {...props}
    >
      {size === '$l' ? (
        <LargePreviewRenderer content={previewContent} />
      ) : (
        <SmallPreviewRenderer content={previewContent} />
      )}
    </PreviewFrame>
  );
}

const LargePreviewBlockWrapper = styled(View, {
  padding: '$2xl',
  variants: {
    block: (block: BlockData) => {
      switch (block.type) {
        case 'image':
        case 'video':
        case 'reference':
        case 'embed':
        case 'code': {
          return {
            padding: 0,
          };
        }
      }
    },
  } as const,
});

const LargePreviewImageBlock = styled(ImageBlock, {
  borderRadius: 0,
});

const LargePreviewVideoBlock = styled(VideoBlock, {
  borderRadius: 0,
});

const LargePreviewCodeBlock = styled(CodeBlock, {
  borderRadius: 0,
  borderWidth: 0,
});

const LargePreviewContentReference = styled(ReferenceBlock, {
  borderRadius: 0,
  borderWidth: 0,
  contentSize: '$l',
  height: '100%',
});

function LargePreviewRenderer({ content }: { content: PostContent }) {
  return (
    <ContentRenderer
      borderColor={'$border'}
      content={content.slice(0, 1)}
      blockRenderers={{
        blockWrapper: LargePreviewBlockWrapper,
        image: LargePreviewImageBlock,
        reference: LargePreviewContentReference,
        code: LargePreviewCodeBlock,
        video: LargePreviewVideoBlock,
      }}
    />
  );
}

const SmallPreviewBlockWrapper = styled(BlockWrapper, {
  padding: '$l',
  flex: 1,
  variants: {
    block: (block: BlockData) => {
      switch (block.type) {
        case 'image':
        case 'video':
        case 'reference':
        case 'embed':
        case 'code': {
          return {
            padding: 0,
          };
        }
      }
    },
  } as const,
});

const SmallPreviewCodeBlock = styled(CodeBlock, {
  contentSize: '$s',
  textProps: {
    size: '$mono/s',
  },
});

const SmallPreviewReferenceBlock = styled(ReferenceBlock, {
  contentSize: '$s',
});

const SmallPreviewLineText = styled(LineText, {
  size: '$label/s',
});

const SmallPreviewImageBlock = ({ block }: { block: ImageBlockData }) => (
  <ImageBlock
    block={block}
    height={'100%'}
    imageProps={{ aspectRatio: 'unset', height: '100%' }}
  />
);

const SmallPreviewVideoBlock = styled(VideoBlock, {
  height: '100%',
});

function SmallPreviewRenderer({
  content,
  ...props
}: { content: PostContent } & ComponentProps<typeof ContentRenderer>) {
  const link = useMemo(() => {
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

  const truncatedHref = useMemo(() => {
    return truncate(link?.href ?? '', { length: 100 });
  }, [link?.href]);

  return link ? (
    <View
      flex={1}
      backgroundColor={'$secondaryBackground'}
      padding="$l"
      gap="$l"
      borderRadius="$m"
    >
      <Icon type="Link" customSize={[24, 17]} />
      <Text size={'$label/s'} color="$secondaryText">
        {link.href !== link.text && link.text && link.text !== ' '
          ? `${link.text}\n\n${truncatedHref}`
          : truncatedHref}
      </Text>
    </View>
  ) : (
    <ContentRenderer
      height={'100%'}
      content={content.slice(0, 1)}
      blockRenderers={{
        blockWrapper: SmallPreviewBlockWrapper,
        reference: SmallPreviewReferenceBlock,
        lineText: SmallPreviewLineText,
        code: SmallPreviewCodeBlock,
        image: SmallPreviewImageBlock,
        video: SmallPreviewVideoBlock,
      }}
      {...props}
    />
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
