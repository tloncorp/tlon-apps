import * as db from '@tloncorp/shared/dist/db';
import { ReactNode, createContext, useContext } from 'react';

export type ChannelState = {
  channel: db.Channel;
};

type ContextValue = ChannelState;

const defaultState: ChannelState = {
  channel: {} as db.Channel,
};

const Context = createContext({
  ...defaultState,
} as ContextValue);

export const useChannelContext = () => {
  const context = useContext(Context);

  if (!context) {
    throw new Error(
      'Must call `useChannelContext` within a `ChannelProvider` component.'
    );
  }

  return context.channel;
};

export const ChannelProvider = ({
  children,
  value,
}: {
  children: ReactNode;
  value: ChannelState;
}) => {
  return <Context.Provider value={value}>{children}</Context.Provider>;
};
