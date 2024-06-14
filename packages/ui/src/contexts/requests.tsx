import {
  useChannel as useChannelFromStore,
  useGroupPreview,
  usePostWithRelations,
} from '@tloncorp/shared/dist';
import * as db from 'packages/shared/dist/db';
import { PropsWithChildren, createContext, useContext, useMemo } from 'react';

type State = {
  usePost: typeof usePostWithRelations;
  useChannel: typeof useChannelFromStore;
  useGroup: typeof useGroupPreview;
  useApp: (id: string) => void;
};

type ContextValue = State;

const Context = createContext<ContextValue>({
  usePost: usePostWithRelations,
  useChannel: useChannelFromStore,
  useGroup: useGroupPreview,
  useApp: () => {},
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
  useChannel: typeof useChannelFromStore;
  useGroup: typeof useGroupPreview;
  useApp: (id: string) => void;
};

export const RequestsProvider = ({
  children,
  usePost,
  useChannel,
  useGroup,
  useApp,
}: PropsWithChildren<RequestProviderProps>) => {
  const value = useMemo(
    () => ({ usePost, useChannel, useGroup, useApp }),
    [usePost, useChannel, useGroup, useApp]
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
};

export const useLivePost = (post: db.Post): db.Post => {
  const { usePost } = useRequests();
  const { data: updatedPost } = usePost({ id: post.id }, post);
  return updatedPost ?? post;
};
