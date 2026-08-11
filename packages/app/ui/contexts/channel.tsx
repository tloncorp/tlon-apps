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

/**
 * Like `useChannelContext`, but returns null instead of throwing when no
 * `ChannelProvider` is present. For components that can render both inside
 * and outside a channel.
 */
export const useMaybeChannelContext = () => {
  const context = useContext(Context);
  return context?.channel ?? null;
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
