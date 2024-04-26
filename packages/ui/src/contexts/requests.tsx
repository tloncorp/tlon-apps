import {
  useChannel as useChannelFromStore,
  usePostWithRelations,
} from '@tloncorp/shared/dist';
import { PropsWithChildren, createContext, useContext, useMemo } from 'react';

type State = {
  usePost: typeof usePostWithRelations;
  useChannel: typeof useChannelFromStore;
  useGroup: (id: string) => void;
  useApp: (id: string) => void;
};

type ContextValue = State;

const Context = createContext<ContextValue>({
  usePost: usePostWithRelations,
  useChannel: useChannelFromStore,
  useGroup: () => {},
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
  usePost?: typeof usePostWithRelations;
  useChannel?: typeof useChannelFromStore;
  useGroup?: (id: string) => void;
  useApp?: (id: string) => void;
};

export const RequestsProvider: React.FC<
  PropsWithChildren<RequestProviderProps>
> = ({
  children,
  usePost,
  useChannel,
  useGroup,
  useApp,
}: {
  children: React.ReactNode;
  usePost: typeof usePostWithRelations;
  useChannel: typeof useChannelFromStore;
  useGroup: (id: string) => void;
  useApp: (id: string) => void;
}) => {
  const value = useMemo(
    () => ({ usePost, useChannel, useGroup, useApp }),
    [usePost, useChannel, useGroup, useApp]
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
};
