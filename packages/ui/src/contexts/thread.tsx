import * as db from '@tloncorp/shared/dist/db';
import { ReactNode, createContext, useContext } from 'react';

export type ThreadState = {
  group?: db.Group | null;
  channel: db.Channel;
  post: db.Post | null;
};

type ContextValue = ThreadState;

const defaultState: ThreadState = {
  group: undefined,
  channel: {} as db.Channel,
  post: {} as db.Post,
};

const Context = createContext({
  ...defaultState,
} as ContextValue);

export const useThreadContext = () => {
  const context = useContext(Context);

  if (!context) {
    throw new Error(
      'Must call `useThread` within an `ThreadProvider` component.'
    );
  }

  return context;
};

export const ThreadProvider = ({
  children,
  value,
}: {
  children: ReactNode;
  value: ThreadState;
}) => {
  return <Context.Provider value={value}>{children}</Context.Provider>;
};
