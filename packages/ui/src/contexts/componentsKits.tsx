import { DraftInputId, PostContentRendererId } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/dist/db';
import { Story } from '@tloncorp/shared/dist/urbit';
import {
  ReactElement,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import { PictoMessage } from '../components/Channel/PictoMessage';
import { ChatMessage } from '../components/ChatMessage';
import { StandaloneDrawingInput } from '../components/DrawingInput';
import { GalleryPost } from '../components/GalleryPost';
import { NotebookPost } from '../components/NotebookPost';
import {
  ChatInput,
  DraftInputContext,
  GalleryInput,
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

  // TODO: Remove
  registerRenderer: (
    id: string,
    renderer: RenderItemType
  ) => { unregister: () => void };
}

const _globalContextValue: ComponentsKitContextValue = {
  renderers: {},
  inputs: {},
  registerRenderer(id, renderer) {
    this.renderers[id] = renderer;
    return {
      unregister: () => {
        delete this.renderers[id];
      },
    };
  },
};

const ComponentsKitContext =
  createContext<ComponentsKitContextValue>(_globalContextValue);

export function useComponentsKitContext() {
  return useContext(ComponentsKitContext);
}

export function ComponentsKitContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [renderers, setRenderers] = useState<{ [id: string]: RenderItemType }>({
    [PostContentRendererId.chat]: ChatMessage,
    [PostContentRendererId.gallery]: GalleryPost,
    [PostContentRendererId.notebook]: NotebookPost,
    [PostContentRendererId.picto]: PictoMessage,
  });
  const [inputs] = useState<{ [id: string]: DraftInputRendererComponent }>({
    [DraftInputId.chat]: ChatInput,
    [DraftInputId.gallery]: GalleryInput,
    [DraftInputId.notebook]: NotebookInput,
    [DraftInputId.picto]: StandaloneDrawingInput,
  });

  const registerRenderer = useCallback(
    (id: string, renderer: RenderItemType) => {
      setRenderers((prev) => ({ ...prev, [id]: renderer }));
      return {
        unregister: () => {
          setRenderers((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        },
      };
    },
    [setRenderers]
  );

  const value = useMemo(
    () => ({ renderers, inputs, registerRenderer }),
    [renderers, inputs, registerRenderer]
  );

  return (
    <ComponentsKitContext.Provider value={value}>
      {children}
    </ComponentsKitContext.Provider>
  );
}
