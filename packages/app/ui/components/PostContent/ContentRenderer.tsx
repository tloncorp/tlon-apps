import { submitA2UIUserAction } from '@tloncorp/api';
import { Post } from '@tloncorp/shared/db';
import { PostContent, convertContent } from '@tloncorp/shared/logic';
import { ComponentProps, useCallback, useMemo } from 'react';
import React from 'react';
import { YStack, styled } from 'tamagui';

import {
  BlockRenderer,
  BlockRendererConfig,
  BlockRendererProvider,
  DefaultRendererProps,
} from './BlockRenderer';
import { InlineRendererConfig, InlineRendererProvider } from './InlineRenderer';
import type { A2UIActionSource, A2UIUserActionEnvelope } from './a2uiActions';
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

function getA2UIActionHostShip(content: PostContent): string | undefined {
  for (const block of content) {
    if (
      block.type === 'a2ui' &&
      typeof block.a2ui.actionHostShip === 'string' &&
      block.a2ui.actionHostShip.trim()
    ) {
      return block.a2ui.actionHostShip.trim();
    }
  }
  return undefined;
}

export function PostContentRenderer({
  post,
  onA2UIUserAction,
  ...props
}: PostContentRendererProps) {
  const content = useMemo(() => {
    // apparently sometimes the content is literally the string "null"
    if (!post.content || post.content == 'null') {
      return [];
    }
    const content = convertContent(post.content, post.blob);
    return content;
  }, [post.content, post.blob]);
  const actionHostShip = getA2UIActionHostShip(content) ?? post.authorId;
  const handleA2UIUserAction = useCallback(
    async (envelope: A2UIUserActionEnvelope, source?: A2UIActionSource) => {
      if (onA2UIUserAction) {
        return onA2UIUserAction(envelope, source);
      }

      await submitA2UIUserAction({ envelope, source });
    },
    [onA2UIUserAction]
  );

  return (
    <BlockRendererProvider>
      <InlineRendererProvider value={undefined}>
        <ContentRenderer
          content={content}
          a2uiSource={{
            postId: post.id,
            channelId: post.channelId,
            authorId: post.authorId,
            actionHostShip,
          }}
          onA2UIUserAction={handleA2UIUserAction}
          {...props}
        />
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
  a2uiSource,
  onA2UIUserAction,
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
      a2uiSource={a2uiSource}
      onA2UIUserAction={onA2UIUserAction}
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
