import { Post } from '@tloncorp/shared/db';
import { PostContent, convertContent } from '@tloncorp/shared/logic';
import { ComponentProps, useMemo } from 'react';
import React from 'react';
import { YStack, styled } from 'tamagui';

import { ActionButtonRow } from './ActionButtonBlock';
import { PokeTemplateContext } from './actionButtonPoke';
import { groupActionButtonBlocks } from './actionButtonUtils';
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
    const content = convertContent(post.content, post.blob);
    return content;
  }, [post.content, post.blob]);

  const templateContext = useMemo<PokeTemplateContext>(
    () => ({
      targetUser: post.authorId ?? undefined,
      currentChannel: post.channelId ?? undefined,
      targetChannel: post.channelId ?? undefined,
      sourcePostId: post.id ?? undefined,
    }),
    [post.authorId, post.channelId, post.id]
  );

  return (
    <BlockRendererProvider>
      <InlineRendererProvider value={undefined}>
        <ContentRenderer
          content={content}
          templateContext={templateContext}
          {...props}
        />
      </InlineRendererProvider>
    </BlockRendererProvider>
  );
}

function ContentRenderer({
  content,
  templateContext,
  onPressImage,
  onLongPress,
  isNotice,
  searchQuery,
  ...rest
}: ContentRendererProps & {
  content: PostContent;
  templateContext?: PokeTemplateContext;
}) {
  const renderItems = useMemo(() => groupActionButtonBlocks(content), [content]);

  return (
    <ContentContext.Provider
      onPressImage={onPressImage}
      onLongPress={onLongPress}
      isNotice={isNotice}
      searchQuery={searchQuery}
    >
      <ContentRendererFrame {...rest}>
        {renderItems.map((item, k) => {
          if (item.type === 'action-button-row') {
            return (
              <ActionButtonRow
                key={`action-buttons-${k}`}
                actionButtons={item.actionButtons}
                templateContext={templateContext}
              />
            );
          }

          return (
            <BlockRenderer
              key={k}
              block={item.block}
              templateContext={templateContext}
            />
          );
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
