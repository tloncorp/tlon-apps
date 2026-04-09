import { PropsWithChildren, createContext, useContext } from 'react';

import type { ChannelShareIntent } from '../../types/shareIntent';

export type QueuedChannelShareIntent = {
  channelId: string;
  shareIntent: ChannelShareIntent;
};

export type ChannelShareIntentContextValue = {
  pendingShareIntent: QueuedChannelShareIntent | null;
  popShareIntent: (channelId: string) => ChannelShareIntent | null;
};

const Context = createContext<ChannelShareIntentContextValue>({
  pendingShareIntent: null,
  popShareIntent: () => null,
});

export function useChannelShareIntent() {
  return useContext(Context);
}

export function ChannelShareIntentProvider({
  children,
  value,
}: PropsWithChildren<{
  value: ChannelShareIntentContextValue;
}>) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
