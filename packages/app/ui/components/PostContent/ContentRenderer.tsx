import { Post } from '@tloncorp/shared/db';
import { PostContent, convertContent } from '@tloncorp/shared/logic';
import { ComponentProps, useMemo } from 'react';
import React from 'react';
import { YStack, styled } from 'tamagui';

import { useOptionalChannelContext } from '../../contexts/channel';
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
  groupId,
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

  return (
    <BlockRendererProvider>
      <InlineRendererProvider value={undefined}>
        <ContentRenderer
          content={content}
          {...props}
          groupId={groupId ?? post.groupId}
        />
      </InlineRendererProvider>
    </BlockRendererProvider>
  );
}

function ContentRenderer({
  content,
  groupId,
  onPressImage,
  getImageViewerId,
  onLongPress,
  onA2UIAction,
  isA2UIActionAvailable,
  canSendA2UIResponse,
  areA2UISelectionsPending,
  a2uiSourcePostId,
  getConsumedA2UISelection,
  isNotice,
  searchQuery,
  ...rest
}: ContentRendererProps & {
  content: PostContent;
}) {
  const channel = useOptionalChannelContext();

  return (
    <ContentContext.Provider
      groupId={groupId ?? channel?.groupId}
      onPressImage={onPressImage}
      getImageViewerId={getImageViewerId}
      onLongPress={onLongPress}
      onA2UIAction={onA2UIAction}
      isA2UIActionAvailable={isA2UIActionAvailable}
      canSendA2UIResponse={canSendA2UIResponse}
      areA2UISelectionsPending={areA2UISelectionsPending}
      a2uiSourcePostId={a2uiSourcePostId}
      getConsumedA2UISelection={getConsumedA2UISelection}
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
