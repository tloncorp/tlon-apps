import { Post } from '@tloncorp/shared/db';
import { PostContent, convertContent } from '@tloncorp/shared/logic';
import { ComponentProps, useMemo } from 'react';
import React from 'react';
import { YStack, isWeb, styled } from 'tamagui';

import { browserSessionLinkCard } from '../../../features/browser/browserSessionLinkCard';

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
  isA2UIActionConsumed,
  canSendA2UIResponse,
  areA2UISelectionsPending,
  a2uiSourcePostId,
  canUseAgentProviderControls,
  getConfiguredAgentProviderIds,
  provisionedAgentTopics,
  consumedA2UIMessageText,
  getConsumedA2UISelection,
  isNotice,
  searchQuery,
  renderBrowserSessionCards = false,
  ...rest
}: ContentRendererProps & {
  content: PostContent;
  renderBrowserSessionCards?: boolean;
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
      isA2UIActionConsumed={isA2UIActionConsumed}
      canSendA2UIResponse={canSendA2UIResponse}
      areA2UISelectionsPending={areA2UISelectionsPending}
      a2uiSourcePostId={a2uiSourcePostId}
      canUseAgentProviderControls={canUseAgentProviderControls}
      getConfiguredAgentProviderIds={getConfiguredAgentProviderIds}
      provisionedAgentTopics={provisionedAgentTopics}
      consumedA2UIMessageText={consumedA2UIMessageText}
      getConsumedA2UISelection={getConsumedA2UISelection}
      isNotice={isNotice}
      searchQuery={searchQuery}
    >
      <ContentRendererFrame {...rest}>
        {content.map((block, k) => {
          return (
            <BlockRenderer
              key={k}
              block={
                isWeb || !renderBrowserSessionCards
                  ? block
                  : browserSessionLinkCard(block, `browser-link-${k}`)
              }
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
  renderBrowserSessionCards = false,
}: {
  blockRenderers?: Partial<BlockRendererConfig>;
  blockSettings?: Partial<DefaultRendererProps>;
  inlineRenderers?: Partial<InlineRendererConfig>;
  renderBrowserSessionCards?: boolean;
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
          <ContentRenderer
            {...props}
            renderBrowserSessionCards={renderBrowserSessionCards}
          />
        </InlineRendererProvider>
      </BlockRendererProvider>
    );
  });
}
