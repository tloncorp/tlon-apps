import { DraftInputId, PostContentRendererId } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/dist/db';
import { Story } from '@tloncorp/shared/dist/urbit';
import { ReactElement, createContext, useContext, useMemo } from 'react';

import { AudioPost } from '../components/AudioPost';
import { ChatMessage } from '../components/ChatMessage';
import { GalleryPost } from '../components/GalleryPost';
import { NotebookPost } from '../components/NotebookPost';
import {
  ChatInput,
  DraftInputContext,
  GalleryInput,
  MicInput,
  NotebookInput,
} from '../components/draftInputs';

type RenderItemFunction = (props: {
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
}) => ReactElement | null;

export type RenderItemType =
  | RenderItemFunction
  | React.MemoExoticComponent<RenderItemFunction>;

type DraftInputRendererComponent = React.ComponentType<{
  draftInputContext: DraftInputContext;
}>;

interface ComponentsKitContextValue {
  renderers: Readonly<
    Partial<{ [Id in PostContentRendererId]: RenderItemType }>
  >;
  inputs: Readonly<
    Partial<{ [Id in DraftInputId]: DraftInputRendererComponent }>
  >;
}

const _globalContextValue: ComponentsKitContextValue = {
  renderers: {},
  inputs: {},
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
  [PostContentRendererId.audio]: AudioPost,
};
const BUILTIN_DRAFT_INPUTS: { [id: string]: DraftInputRendererComponent } = {
  [DraftInputId.chat]: ChatInput,
  [DraftInputId.gallery]: GalleryInput,
  [DraftInputId.notebook]: NotebookInput,
  [DraftInputId.mic]: MicInput,
};

export function ComponentsKitContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({
      renderers: BUILTIN_CONTENT_RENDERERS,
      inputs: BUILTIN_DRAFT_INPUTS,
    }),
    []
  );

  return (
    <ComponentsKitContext.Provider value={value}>
      {children}
    </ComponentsKitContext.Provider>
  );
}
