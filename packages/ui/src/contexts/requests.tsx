import {
  useChannel as useChannelFromStore,
  useGroupPreview,
  usePostReference,
  usePostWithRelations,
} from '@tloncorp/shared/dist';
import { isEqual } from 'lodash';
import * as db from 'packages/shared/dist/db';
import {
  PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

type State = {
  usePost: typeof usePostWithRelations;
  useChannel: typeof useChannelFromStore;
  useGroup: typeof useGroupPreview;
  useApp: (id: string) => void;
  usePostReference: typeof usePostReference;
};

type ContextValue = State;

const Context = createContext<ContextValue>({
  usePost: usePostWithRelations,
  useChannel: useChannelFromStore,
  useGroup: useGroupPreview,
  useApp: () => {},
  usePostReference: usePostReference,
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
  usePostReference: typeof usePostReference;
};

export const RequestsProvider = ({
  children,
  usePost,
  usePostReference,
  useChannel,
  useGroup,
  useApp,
}: PropsWithChildren<RequestProviderProps>) => {
  const value = useMemo(
    () => ({ usePost, useChannel, useGroup, useApp, usePostReference }),
    [usePost, useChannel, useGroup, useApp, usePostReference]
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
};

export const useLivePost = (initialPost: db.Post): db.Post => {
  const [post, setPost] = useState(initialPost);
  const { usePost } = useRequests();
  const { data: updatedPost } = usePost({ id: initialPost.id }, initialPost);

  const prevInitialPostRef = useRef(initialPost);
  const prevUpdatedPostRef = useRef(updatedPost);

  useEffect(() => {
    if (updatedPost && !isEqual(updatedPost, prevUpdatedPostRef.current)) {
      setPost(updatedPost);
      prevUpdatedPostRef.current = updatedPost;
    } else if (!isEqual(initialPost, prevInitialPostRef.current)) {
      setPost(initialPost);
      prevInitialPostRef.current = initialPost;
    }
  }, [updatedPost, initialPost]);

  return post;
};
