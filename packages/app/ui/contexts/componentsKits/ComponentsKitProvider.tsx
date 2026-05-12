import {
  CollectionRendererId,
  DraftInputId,
  JSONValue,
  PostContentRendererId,
} from '@tloncorp/shared';
import { useMemo } from 'react';
import { Text } from 'react-native';

import { AudioPost } from '../../components/AudioPost';
import { ChatMessage } from '../../components/ChatMessage';
import { ColorPost } from '../../components/ColorPost';
import { useContactName } from '../../components/ContactNameV2';
import { EditableNotePostContent } from '../../components/EditableNotePostContent';
import { GalleryPost } from '../../components/GalleryPost';
import { NotebookPost } from '../../components/NotebookPost';
import {
  NotesDraftInput,
  NotesPostCollection,
  NotesPostContent,
} from '../../components/NotesChannel';
import { YellPost } from '../../components/YellPost';
import {
  ChatInput,
  ColorInput,
  GalleryInput,
  MicInput,
  NotebookInput,
} from '../../components/draftInputs';
import { ButtonInput } from '../../components/draftInputs/ButtonInput';
import { BoardroomPostCollectionView } from '../../components/postCollectionViews/BoardroomPostCollectionView';
import {
  CardsPostCollection,
  SingleCardPostCollection,
} from '../../components/postCollectionViews/CardsPostCollectionView';
import { CarouselPostCollection } from '../../components/postCollectionViews/CarouselPostCollectionView';
import { ListPostCollection } from '../../components/postCollectionViews/ListPostCollectionView';
import { StrobePostCollectionView } from '../../components/postCollectionViews/StrobePostCollectionView';
import { PostSummaryCollectionView } from '../../components/postCollectionViews/SummaryCollectionView';
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
  [PostContentRendererId.notes]: NotesPostContent,
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
  [DraftInputId.notes]: NotesDraftInput,
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
