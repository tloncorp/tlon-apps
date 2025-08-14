import {
  CollectionRendererId,
  DraftInputId,
  JSONValue,
  PostContentRendererId,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Story } from '@tloncorp/shared/urbit';
import { ReactElement, createContext, useContext, useMemo } from 'react';
import { Text } from 'react-native';

import { AudioPost } from '../components/AudioPost';
import { ChatMessage } from '../components/ChatMessage';
import { ColorPost } from '../components/ColorPost';
import { useContactName } from '../components/ContactNameV2';
import { EditableNotePostContent } from '../components/EditableNotePostContent';
import { GalleryPost } from '../components/GalleryPost';
import { NotebookPost } from '../components/NotebookPost';
import { YellPost } from '../components/YellPost';
import {
  ChatInput,
  ColorInput,
  DraftInputContext,
  GalleryInput,
  MicInput,
  NotebookInput,
} from '../components/draftInputs';
import { ButtonInput } from '../components/draftInputs/ButtonInput';
import { BoardroomPostCollectionView } from '../components/postCollectionViews/BoardroomPostCollectionView';
import {
  CardsPostCollection,
  SingleCardPostCollection,
} from '../components/postCollectionViews/CardsPostCollectionView';
import { CarouselPostCollection } from '../components/postCollectionViews/CarouselPostCollectionView';
import { ListPostCollection } from '../components/postCollectionViews/ListPostCollectionView';
import { StrobePostCollectionView } from '../components/postCollectionViews/StrobePostCollectionView';
import { PostSummaryCollectionView } from '../components/postCollectionViews/SummaryCollectionView';
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
  onPressRetry?: (post: db.Post) => Promise<void>;
  onPressDelete: (post: db.Post) => void;
  onShowEmojiPicker?: () => void;
  onPressEdit?: () => void;
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
  onPressEdit?: () => void;
  onPressReplies?: (post: db.Post) => void;
  onPressImage?: (post: db.Post, imageUri?: string) => void;
  onLongPress?: (post: db.Post) => void;
  editing?: boolean;
  setEditingPost?: (post: db.Post | undefined) => void;
  setViewReactionsPost?: (post: db.Post) => void;
  editPost?: (post: db.Post, content: Story) => Promise<void>;
  onPressRetry?: (post: db.Post) => void;
  onPressDelete?: (post: db.Post) => void;
  onShowEmojiPicker?: () => void;
  isHighlighted?: boolean;
  contentRendererConfiguration?: Record<string, unknown>;
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

const BUILTIN_CONTENT_RENDERERS: { [id: string]: RenderItemType } = {
  [PostContentRendererId.chat]: ChatMessage,
  [PostContentRendererId.gallery]: GalleryPost,
  [PostContentRendererId.notebook]: NotebookPost,
  [PostContentRendererId.audio]: AudioPost,
  [PostContentRendererId.color]: ColorPost,
  [PostContentRendererId.raw]: ({ post, contentRendererConfiguration }) => {
    const contactName = useContactName(post.author!.id);
    return (
      <Text
        style={{
          fontFamily: JSONValue.asString(
            contentRendererConfiguration?.fontFamily,
            undefined
          ),
        }}
      >
        {contactName}: {JSON.stringify(post.content)}
      </Text>
    );
  },
  [PostContentRendererId.yell]: YellPost,
  [PostContentRendererId.scratchpad]: EditableNotePostContent,
};
const BUILTIN_DRAFT_INPUTS: { [id: string]: DraftInputRendererComponent } = {
  [DraftInputId.chat]: ChatInput,
  [DraftInputId.gallery]: GalleryInput,
  [DraftInputId.notebook]: NotebookInput,
  [DraftInputId.yo]: ({ draftInputContext }) => (
    <ButtonInput
      draftInputContext={draftInputContext}
      messageText={JSONValue.asString(
        draftInputContext.configuration?.text,
        'Yo'
      )}
      labelText={JSONValue.asString(
        draftInputContext.configuration?.text,
        'Yo'
      )}
    />
  ),
  [DraftInputId.mic]: MicInput,
  [DraftInputId.color]: ColorInput,
};
const BUILTIN_COLLECTION_RENDERERS: {
  [id in CollectionRendererId]: IPostCollectionView;
} = {
  [CollectionRendererId.chat]: ListPostCollection,
  [CollectionRendererId.gallery]: ListPostCollection,
  [CollectionRendererId.notebook]: ListPostCollection,
  [CollectionRendererId.carousel]: CarouselPostCollection,
  [CollectionRendererId.cards]: CardsPostCollection,
  [CollectionRendererId.sign]: SingleCardPostCollection,
  [CollectionRendererId.boardroom]: BoardroomPostCollectionView,
  [CollectionRendererId.strobe]: StrobePostCollectionView,
  [CollectionRendererId.summaries]: PostSummaryCollectionView,
};

const _globalContextValue: ComponentsKitContextValue = {
  collectionRenderers: BUILTIN_COLLECTION_RENDERERS,
  inputs: BUILTIN_DRAFT_INPUTS,
  renderers: BUILTIN_CONTENT_RENDERERS,
};

const ComponentsKitContext =
  createContext<ComponentsKitContextValue>(_globalContextValue);

export function useComponentsKitContext() {
  return useContext(ComponentsKitContext);
}
