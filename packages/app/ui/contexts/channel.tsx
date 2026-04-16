import * as db from '@tloncorp/shared/db';
import { ReactNode, createContext, useContext } from 'react';

type ChannelState = {
  channel: db.Channel;
} | null;

const Context = createContext<ChannelState>(null);

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
