import * as db from '@tloncorp/shared/db';
import { ReactNode, createContext, useContext } from 'react';

export type ChannelState = {
  channel: db.Channel;
};

const Context = createContext<ChannelState | null>(null);

export const useChannelContext = () => {
  const context = useContext(Context);

  if (!context) {
    throw new Error(
      'Must call `useChannelContext` within a `ChannelProvider` component.'
    );
  }

  return context.channel;
};

export function useChannelContextOrNull() {
  return useContext(Context)?.channel ?? null;
}

export const ChannelProvider = ({
  children,
  value,
}: {
  children: ReactNode;
  value: ChannelState;
}) => {
  return <Context.Provider value={value}>{children}</Context.Provider>;
};
