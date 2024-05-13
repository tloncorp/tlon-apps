import * as db from '@tloncorp/shared/dist/db';
import { ReactNode, createContext, useContext } from 'react';

export type AddChatState = {
  onCreatedGroup: ({
    group,
    channel,
  }: {
    group: db.Group;
    channel: db.Channel;
  }) => void;
  onStartDm: (participants: string[]) => void;
};

type ContextValue = AddChatState;

const defaultState: AddChatState = {
  onCreatedGroup: () => {},
  onStartDm: () => {},
};

const Context = createContext({
  ...defaultState,
} as ContextValue);

export const useAddChatHandlers = () => {
  const context = useContext(Context);

  if (!context) {
    throw new Error('Must call `useCalm` within an `CalmProvider` component.');
  }

  return context;
};

export const AddChatProvider = ({
  children,
  handlers,
}: {
  children: ReactNode;
  handlers?: AddChatState;
}) => {
  return (
    <Context.Provider value={handlers ?? defaultState}>
      {children}
    </Context.Provider>
  );
};
