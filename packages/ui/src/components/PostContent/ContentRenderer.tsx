import { Post } from '@tloncorp/shared/dist/db';
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
import {
  ContentContext,
  ContentContextProps,
  PostContent,
  convertContent,
} from './contentUtils';

const ContentRendererFrame = styled(YStack, {
  name: 'ContentFrame',
  context: ContentContext,
  width: '100%',
});

// Renderers

type ContentRendererProps = ContentContextProps &
  Omit<ComponentProps<typeof YStack>, 'content'>;

type PostContentRendererProps = ContentRendererProps & {
  post: Post;
  renderReferences?: boolean;
};

export function PostContentRenderer({
  post,
  renderReferences = true,
  ...props
}: PostContentRendererProps) {
  const content = useMemo(() => {
    // apparently sometimes the content is literally the string "null"
    if (!post.content || post.content == 'null') {
      return [];
    }
    const content = convertContent(post.content);
    // We don't want to render nested references
    return !renderReferences
      ? content.filter((b) => b.type !== 'reference')
      : content;
  }, [post.content, renderReferences]);

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
  ...props
}: ContentRendererProps & {
  content: PostContent;
}) {
  return (
    <ContentContext.Provider
      onPressImage={props.onPressImage}
      onLongPress={props.onLongPress}
      isNotice={props.isNotice}
    >
      <ContentRendererFrame {...props}>
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
