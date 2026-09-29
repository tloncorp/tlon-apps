import {
  CollectionRendererId,
  DraftInputId,
  PostContentRendererId,
} from '@tloncorp/shared';
import { useMemo } from 'react';

import { BucketsPostCollection } from '../../components/BucketsChannel/BucketsPostCollection';
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
import {
  ComponentsKitContext,
  ComponentsKitContextValue,
  DraftInputRendererComponent,
  RenderItemType,
} from './componentsKits';

const EmptyNotesRenderer = () => null;
const EmptyBucketsRenderer = () => null;

const BUILTIN_CONTENT_RENDERERS: { [id: string]: RenderItemType } = {
  [PostContentRendererId.chat]: ChatMessage,
  [PostContentRendererId.gallery]: GalleryPost,
  [PostContentRendererId.notebook]: NotebookPost,
  [PostContentRendererId.notes]: EmptyNotesRenderer,
  [PostContentRendererId.buckets]: EmptyBucketsRenderer,
};
const BUILTIN_DRAFT_INPUTS: { [id: string]: DraftInputRendererComponent } = {
  [DraftInputId.chat]: ChatInput,
  [DraftInputId.gallery]: GalleryInput,
  [DraftInputId.notebook]: NotebookInput,
  [DraftInputId.notes]: EmptyNotesRenderer,
  [DraftInputId.buckets]: EmptyBucketsRenderer,
};
const BUILTIN_COLLECTION_RENDERERS: {
  [id in CollectionRendererId]: IPostCollectionView;
} = {
  [CollectionRendererId.chat]: ListPostCollection,
  [CollectionRendererId.gallery]: ListPostCollection,
  [CollectionRendererId.notebook]: ListPostCollection,
  [CollectionRendererId.notes]: NotesPostCollection,
  [CollectionRendererId.buckets]: BucketsPostCollection,
};

export function ComponentsKitProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const contextValue: ComponentsKitContextValue = useMemo(
    () => ({
      collectionRenderers: BUILTIN_COLLECTION_RENDERERS,
      inputs: BUILTIN_DRAFT_INPUTS,
      renderers: BUILTIN_CONTENT_RENDERERS,
    }),
    []
  );

  return (
    <ComponentsKitContext.Provider value={contextValue}>
      {children}
    </ComponentsKitContext.Provider>
  );
}
