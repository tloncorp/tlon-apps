import { Story } from '@tloncorp/api/urbit';
import {
  CollectionRendererId,
  DraftInputId,
  PostContentRendererId,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { ReactElement, createContext, useContext } from 'react';

import { DraftInputContext } from '../../components/draftInputs';
import { IPostCollectionView } from '../../components/postCollectionViews/shared';

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
  onPressRetry?: (post: db.Post) => Promise<void>;
  onPressDelete: (post: db.Post) => void;
  onShowEmojiPicker?: (post: db.Post) => void;
  onPressEdit?: (post: db.Post) => void;
  isHighlighted?: boolean;
  displayDebugMode?: boolean;
  contentRendererConfiguration?: Record<string, unknown>;
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
  onPressEdit?: (post: db.Post) => void;
  onPressReplies?: (post: db.Post) => void;
  onPressImage?: (post: db.Post, imageUri?: string) => void;
  onLongPress?: (post: db.Post) => void;
  editing?: boolean;
  setEditingPost?: (post: db.Post | undefined) => void;
  setViewReactionsPost?: (post: db.Post) => void;
  editPost?: (post: db.Post, content: Story) => Promise<void>;
  onPressRetry?: (post: db.Post) => void;
  onPressDelete?: (post: db.Post) => void;
  onShowEmojiPicker?: (post: db.Post) => void;
  isHighlighted?: boolean;
  contentRendererConfiguration?: Record<string, unknown>;
};
export type MinimalRenderItemType = React.ComponentType<MinimalRenderItemProps>;

export type DraftInputRendererComponent = React.ComponentType<{
  draftInputContext: DraftInputContext;
}>;

export interface ComponentsKitContextValue {
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

export const ComponentsKitContext = createContext<ComponentsKitContextValue>({
  collectionRenderers: {},
  inputs: {},
  renderers: {},
});

export function useComponentsKitContext() {
  return useContext(ComponentsKitContext);
}
