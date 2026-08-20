import {
  CollectionRendererId,
  DraftInputId,
  PostContentRendererId,
  createDevLogger,
} from '@tloncorp/shared';
import { useMemo } from 'react';

import { ChatMessage } from '../../components/ChatMessage';
import { GalleryPost } from '../../components/GalleryPost';
import { NotebookPost } from '../../components/NotebookPost';
import { NotesPostCollection } from '../../components/NotesChannel/NotesPostCollection';
import {
  ChatInput,
  GalleryInput,
  NotebookInput,
} from '../../components/draftInputs';
import { ListPostCollection } from '../../components/postCollectionViews/ListPostCollectionView';
import { IPostCollectionView } from '../../components/postCollectionViews/shared';
import { ChannelView, mergeChannelViews } from './channelViews';
import {
  ComponentsKitContext,
  ComponentsKitContextValue,
  DraftInputRendererComponent,
  RenderItemType,
} from './componentsKits';

const logger = createDevLogger('ComponentsKit', false);

const EmptyNotesRenderer = () => null;

const BUILTIN_CONTENT_RENDERERS: { [id: string]: RenderItemType } = {
  [PostContentRendererId.chat]: ChatMessage,
  [PostContentRendererId.gallery]: GalleryPost,
  [PostContentRendererId.notebook]: NotebookPost,
  [PostContentRendererId.notes]: EmptyNotesRenderer,
};
const BUILTIN_DRAFT_INPUTS: { [id: string]: DraftInputRendererComponent } = {
  [DraftInputId.chat]: ChatInput,
  [DraftInputId.gallery]: GalleryInput,
  [DraftInputId.notebook]: NotebookInput,
  [DraftInputId.notes]: EmptyNotesRenderer,
};
const BUILTIN_COLLECTION_RENDERERS: { [id: string]: IPostCollectionView } = {
  [CollectionRendererId.chat]: ListPostCollection,
  [CollectionRendererId.gallery]: ListPostCollection,
  [CollectionRendererId.notebook]: ListPostCollection,
  [CollectionRendererId.notes]: NotesPostCollection,
};

const NO_VIEWS: readonly ChannelView[] = [];

/**
 * `views` registers renderers a channel can name without that id existing in
 * `@tloncorp/api`'s built-in enums. Built-ins win on collision — see
 * `mergeChannelViews` — and a channel naming a view nobody registered degrades
 * per `docs/tlon-apps/channel-views.md` rather than rendering nothing.
 */
export function ComponentsKitProvider({
  children,
  views = NO_VIEWS,
}: {
  children: React.ReactNode;
  views?: readonly ChannelView[];
}) {
  const contextValue: ComponentsKitContextValue = useMemo(() => {
    const onCollision = (id: string) =>
      logger.warn(
        `ignoring registered view "${id}": a built-in already owns that id`
      );
    return {
      collectionRenderers: mergeChannelViews({
        builtins: BUILTIN_COLLECTION_RENDERERS,
        views,
        slot: (view) => view.collection,
        onCollision,
      }),
      inputs: mergeChannelViews({
        builtins: BUILTIN_DRAFT_INPUTS,
        views,
        slot: (view) => view.input,
        onCollision,
      }),
      renderers: mergeChannelViews({
        builtins: BUILTIN_CONTENT_RENDERERS,
        views,
        slot: (view) => view.content,
        onCollision,
      }),
    };
  }, [views]);

  return (
    <ComponentsKitContext.Provider value={contextValue}>
      {children}
    </ComponentsKitContext.Provider>
  );
}
