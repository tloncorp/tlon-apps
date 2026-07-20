import {
  useChannelPreview,
  useGroupPreview,
  useNoteReference,
  usePostReference,
  usePostWithRelations,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { PropsWithChildren, createContext, useContext, useMemo } from 'react';

type State = {
  usePost: typeof usePostWithRelations;
  useChannel: typeof useChannelPreview;
  useGroup: typeof useGroupPreview;
  useApp: (id: string) => void;
  usePostReference: typeof usePostReference;
  useNoteReference: typeof useNoteReference;
};

type ContextValue = State;

const Context = createContext<ContextValue>({
  usePost: usePostWithRelations,
  useChannel: useChannelPreview,
  useGroup: useGroupPreview,
  useApp: () => {},
  usePostReference: usePostReference,
  useNoteReference: useNoteReference,
});

export const useRequests = () => {
  const context = useContext(Context);
  if (!context) {
    throw new Error(
      'Must call `useRequests` within an `RequestsProvider` component.'
    );
  }
  return context;
};

type RequestProviderProps = {
  usePost: typeof usePostWithRelations;
  useChannel: typeof useChannelPreview;
  useGroup: typeof useGroupPreview;
  useApp: (id: string) => void;
  usePostReference: typeof usePostReference;
  // optional so existing providers fall back to the shared store hook
  useNoteReference?: typeof useNoteReference;
};

export const RequestsProvider = ({
  children,
  usePost,
  usePostReference,
  useChannel,
  useGroup,
  useApp,
  useNoteReference: useNoteReferenceProp,
}: PropsWithChildren<RequestProviderProps>) => {
  const value = useMemo(
    () => ({
      usePost,
      useChannel,
      useGroup,
      useApp,
      usePostReference,
      useNoteReference: useNoteReferenceProp ?? useNoteReference,
    }),
    [
      usePost,
      useChannel,
      useGroup,
      useApp,
      usePostReference,
      useNoteReferenceProp,
    ]
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
};

export const useLivePost = (initialPost: db.Post): db.Post => {
  const { usePost } = useRequests();
  const { data: updatedPost } = usePost({ id: initialPost.id }, initialPost);
  return updatedPost ?? initialPost;
};
