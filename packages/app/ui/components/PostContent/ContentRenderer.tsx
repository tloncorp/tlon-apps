import { Post } from '@tloncorp/shared/db';
import { PostContent, convertContent } from '@tloncorp/shared/logic';
import { ComponentProps, useMemo } from 'react';
import React from 'react';
import { YStack, styled } from 'tamagui';

import {
  BlockRenderer,
  BlockRendererConfig,
  BlockRendererProvider,
  DefaultRendererProps,
} from './BlockRenderer';
import { InlineRendererConfig, InlineRendererProvider } from './InlineRenderer';
import { ContentContext, ContentContextProps } from './contentUtils';

const ContentRendererFrame = styled(YStack, {
  name: 'ContentFrame',
  context: ContentContext,
  width: '100%',
  userSelect: 'text',
});

// Renderers

type ContentRendererProps = ContentContextProps &
  Omit<ComponentProps<typeof YStack>, 'content'>;

type PostContentRendererProps = ContentRendererProps & {
  post: Post;
};

export function PostContentRenderer({
  post,
  ...props
}: PostContentRendererProps) {
  const content = useMemo(() => {
    // apparently sometimes the content is literally the string "null"
    if (!post.content || post.content == 'null') {
      return [];
    }
    const content = convertContent(post.content);
    return content;
  }, [post.content]);

  return (
    <BlockRendererProvider>
      <InlineRendererProvider value={undefined}>
        <ContentRenderer content={content} {...props} />
      </InlineRendererProvider>
    </BlockRendererProvider>
  );
}

function ContentRenderer({
  content,
  onPressImage,
  onLongPress,
  isNotice,
  searchQuery,
  ...rest
}: ContentRendererProps & {
  content: PostContent;
}) {
  return (
    <ContentContext.Provider
      onPressImage={onPressImage}
      onLongPress={onLongPress}
      isNotice={isNotice}
      searchQuery={searchQuery}
    >
      <ContentRendererFrame {...rest}>
        {content.map((block, k) => {
          return <BlockRenderer key={k} block={block} />;
        })}
      </ContentRendererFrame>
    </ContentContext.Provider>
  );
}

export function createContentRenderer({
  blockRenderers,
  blockSettings,
  inlineRenderers,
}: {
  blockRenderers?: Partial<BlockRendererConfig>;
  blockSettings?: Partial<DefaultRendererProps>;
  inlineRenderers?: Partial<InlineRendererConfig>;
}) {
  return React.memo(function ContentRendererWrapper({
    ...props
  }: ContentRendererProps & {
    content: PostContent;
  }) {
    return (
      <BlockRendererProvider
        renderers={blockRenderers}
        settings={blockSettings}
      >
        <InlineRendererProvider value={inlineRenderers}>
          <ContentRenderer {...props} />
        </InlineRendererProvider>
      </BlockRendererProvider>
    );
  });
}
