import { Post } from '@tloncorp/shared/db';
import { PostContent, convertContent } from '@tloncorp/shared/logic';
import { ComponentProps, useContext, useMemo, useState } from 'react';
import React from 'react';
import { Platform } from 'react-native';
import { YStack, styled } from 'tamagui';

import { useOptionalChannelContext } from '../../contexts/channel';
import {
  NativeReadBlockContext,
  NativeReadRowContext,
} from '../../contexts/nativeRead';
import {
  emptyReadBlockLineage,
  reconcileReadBlocks,
} from '../Channel/PostList/nativeReadMetadata';
import { createNativeReadFrame } from './nativeReadFrame';
import {
  BlockRenderer,
  BlockRendererConfig,
  BlockRendererProvider,
  DefaultRendererProps,
  IsInsideReferenceContext,
  useNativeReadBlockManifest,
} from './BlockRenderer';
import { InlineRendererConfig, InlineRendererProvider } from './InlineRenderer';
import { ContentContext, ContentContextProps } from './contentUtils';

const ContentRendererFrame = styled(YStack, {
  name: 'ContentFrame',
  context: ContentContext,
  width: '100%',
  userSelect: 'text',
});

const NativeContentRendererFrame =
  createNativeReadFrame<ComponentProps<typeof ContentRendererFrame>>(
    ContentRendererFrame
  );

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
  ...rest
}: ContentRendererProps & {
  content: PostContent;
}) {
  const channel = useOptionalChannelContext();
  const rowContext = useContext(NativeReadRowContext);
  const insideReference = useContext(IsInsideReferenceContext);
  const row =
    Platform.OS === 'ios' && !insideReference && !rest.render && !rest.asChild
      ? rowContext
      : null;
  const owner = row
    ? JSON.stringify([row.scope, row.visit, row.key, row.revision])
    : null;
  const [reading, setReading] = useState({
    owner,
    lineage: emptyReadBlockLineage,
  });
  const lineage = row
    ? reconcileReadBlocks(
        reading.owner === owner ? reading.lineage : emptyReadBlockLineage,
        content
      )
    : emptyReadBlockLineage;
  // Render-derived React state is discarded with an aborted render. A ref write
  // here would let uncommitted content consume the committed block lineage.
  if (reading.owner !== owner || reading.lineage !== lineage) {
    setReading({ owner, lineage });
  }
  const blocks = useNativeReadBlockManifest(content, lineage);
  const descriptor = row
    ? JSON.stringify({
        ...row,
        kind: 'row',
        blocks,
        unresolvedBlockIds: lineage.unresolvedBlockIds,
      })
    : undefined;

  const renderedContent = (
    <NativeReadRowContext.Provider value={null}>
      <NativeReadBlockContext.Provider value={null}>
        {content.map((block, k) => {
          const metadata = blocks[k];
          const nativeRead =
            row && metadata
              ? {
                  version: row.version,
                  scope: row.scope,
                  visit: row.visit,
                  key: row.key,
                  rowRevision: row.revision,
                  blockId: metadata.id,
                  revision: metadata.revision,
                  kind: metadata.kind,
                  ...('assetKey' in metadata
                    ? { assetKey: metadata.assetKey }
                    : {}),
                }
              : undefined;
          return (
            <BlockRenderer
              key={row ? metadata.id : k}
              block={block}
              nativeRead={nativeRead}
            />
          );
        })}
      </NativeReadBlockContext.Provider>
    </NativeReadRowContext.Provider>
  );

  const Frame = descriptor ? NativeContentRendererFrame : ContentRendererFrame;
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
      <Frame {...rest} {...(descriptor ? { descriptor } : {})}>
        {renderedContent}
      </Frame>
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
