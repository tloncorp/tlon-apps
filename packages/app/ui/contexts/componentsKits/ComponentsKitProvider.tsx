import {
  CollectionRendererId,
  DraftInputId,
  PostContentRendererId,
} from '@tloncorp/shared';
import { useMemo } from 'react';

import { ChatMessage } from '../../components/ChatMessage';
import { GalleryPost } from '../../components/GalleryPost';
import { NotebookPost } from '../../components/NotebookPost';
import {
  NotesDraftInput,
  NotesPostCollection,
  NotesPostContent,
} from '../../components/NotesChannel';
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

const BUILTIN_CONTENT_RENDERERS: { [id: string]: RenderItemType } = {
  [PostContentRendererId.chat]: ChatMessage,
  [PostContentRendererId.gallery]: GalleryPost,
  [PostContentRendererId.notebook]: NotebookPost,
  [PostContentRendererId.notes]: NotesPostContent,
};
const BUILTIN_DRAFT_INPUTS: { [id: string]: DraftInputRendererComponent } = {
  [DraftInputId.chat]: ChatInput,
  [DraftInputId.gallery]: GalleryInput,
  [DraftInputId.notebook]: NotebookInput,
  [DraftInputId.notes]: NotesDraftInput,
};
const BUILTIN_COLLECTION_RENDERERS: {
  [id in CollectionRendererId]: IPostCollectionView;
} = {
  [CollectionRendererId.chat]: ListPostCollection,
  [CollectionRendererId.gallery]: ListPostCollection,
  [CollectionRendererId.notebook]: ListPostCollection,
  [CollectionRendererId.notes]: NotesPostCollection,
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
