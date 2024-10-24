import {
  CollectionRendererId,
  DraftInputId,
  PostContentRendererId,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/dist/db';
import { Story } from '@tloncorp/shared/dist/urbit';
import { ReactElement, createContext, useContext, useMemo } from 'react';

import { AudioPost } from '../components/AudioPost';
import { PictoMessage } from '../components/Channel/PictoMessage';
import { ChatMessage } from '../components/ChatMessage';
import { ColorPost } from '../components/ColorPost';
import { StandaloneDrawingInput } from '../components/DrawingInput';
import { GalleryPost } from '../components/GalleryPost';
import { NotebookPost } from '../components/NotebookPost';
import {
  ChatInput,
  ColorInput,
  DraftInputContext,
  GalleryInput,
  MicInput,
  NotebookInput,
} from '../components/draftInputs';
import { ButtonInput } from '../components/draftInputs/ButtonInput';
import {
  CardsPostCollection,
  SingleCardPostCollection,
} from '../components/postCollectionViews/CardsPostCollectionView';
import { ListPostCollection } from '../components/postCollectionViews/ListPostCollectionView';
import { IPostCollectionView } from '../components/postCollectionViews/shared';

type RenderItemProps = {
  post: db.Post;
  showAuthor?: boolean;
  showReplies?: boolean;
  onPress?: (post: db.Post) => void;
  onPressReplies?: (post: db.Post) => void;
  onPressImage?: (post: db.Post, imageUri?: string) => void;
  onLongPress?: (post: db.Post) => void;
  editing?: boolean;
  setEditingPost?: (post: db.Post | undefined) => void;
  setViewReactionsPost?: (post: db.Post) => void;
  editPost?: (post: db.Post, content: Story) => Promise<void>;
  onPressRetry: (post: db.Post) => void;
  onPressDelete: (post: db.Post) => void;
  isHighlighted?: boolean;
};

type RenderItemFunction = (props: RenderItemProps) => ReactElement | null;

export type RenderItemType =
  | RenderItemFunction
  | React.MemoExoticComponent<RenderItemFunction>;

export type MinimalRenderItemProps = {
  post: db.Post;
  showAuthor?: boolean;
  showReplies?: boolean;
  onPress?: (post: db.Post) => void;
  onPressReplies?: (post: db.Post) => void;
  onPressImage?: (post: db.Post, imageUri?: string) => void;
  onLongPress?: (post: db.Post) => void;
  editing?: boolean;
  setEditingPost?: (post: db.Post | undefined) => void;
  setViewReactionsPost?: (post: db.Post) => void;
  editPost?: (post: db.Post, content: Story) => Promise<void>;
  onPressRetry?: (post: db.Post) => void;
  onPressDelete?: (post: db.Post) => void;
  isHighlighted?: boolean;
};
export type MinimalRenderItemType = React.ComponentType<MinimalRenderItemProps>;

type DraftInputRendererComponent = React.ComponentType<{
  draftInputContext: DraftInputContext;
}>;

interface ComponentsKitContextValue {
  collectionRenderers: Readonly<
    Partial<{ [Id in CollectionRendererId]: IPostCollectionView }>
  >;
  inputs: Readonly<
    Partial<{ [Id in DraftInputId]: DraftInputRendererComponent }>
  >;
  renderers: Readonly<
    Partial<{ [Id in PostContentRendererId]: RenderItemType }>
  >;
}

const _globalContextValue: ComponentsKitContextValue = {
  collectionRenderers: {},
  inputs: {},
  renderers: {},
};

const ComponentsKitContext =
  createContext<ComponentsKitContextValue>(_globalContextValue);

export function useComponentsKitContext() {
  return useContext(ComponentsKitContext);
}

const BUILTIN_CONTENT_RENDERERS: { [id: string]: RenderItemType } = {
  [PostContentRendererId.chat]: ChatMessage,
  [PostContentRendererId.gallery]: GalleryPost,
  [PostContentRendererId.notebook]: NotebookPost,
  [PostContentRendererId.picto]: PictoMessage,
  [PostContentRendererId.audio]: AudioPost,
  [PostContentRendererId.color]: ColorPost,
};
const BUILTIN_DRAFT_INPUTS: { [id: string]: DraftInputRendererComponent } = {
  [DraftInputId.chat]: ChatInput,
  [DraftInputId.gallery]: GalleryInput,
  [DraftInputId.notebook]: NotebookInput,
  [DraftInputId.yo]: ({ draftInputContext }) => (
    <ButtonInput
      draftInputContext={draftInputContext}
      messageText="Yo"
      labelText="Yo"
    />
  ),
  [DraftInputId.picto]: StandaloneDrawingInput,
  [DraftInputId.mic]: MicInput,
  [DraftInputId.color]: ColorInput,
};
const BUILTIN_COLLECTION_RENDERERS: {
  [id in CollectionRendererId]: IPostCollectionView;
} = {
  [CollectionRendererId.chat]: ListPostCollection,
  [CollectionRendererId.gallery]: ListPostCollection,
  [CollectionRendererId.notebook]: ListPostCollection,
  [CollectionRendererId.cards]: CardsPostCollection,
  [CollectionRendererId.sign]: SingleCardPostCollection,
};

export function ComponentsKitContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({
      collectionRenderers: BUILTIN_COLLECTION_RENDERERS,
      inputs: BUILTIN_DRAFT_INPUTS,
      renderers: BUILTIN_CONTENT_RENDERERS,
    }),
    []
  );

  return (
    <ComponentsKitContext.Provider value={value}>
      {children}
    </ComponentsKitContext.Provider>
  );
}
