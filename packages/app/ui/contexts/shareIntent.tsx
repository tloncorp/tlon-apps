import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { ChannelShareIntent } from '../../types/shareIntent';

export type QueuedChannelShareIntent = {
  channelId: string;
  shareIntent: ChannelShareIntent;
};

type ChannelShareIntentContextValue = {
  pendingShareIntent: QueuedChannelShareIntent | null;
  pushShareIntent: (shareIntent: QueuedChannelShareIntent) => void;
  popShareIntent: (channelId: string) => ChannelShareIntent | null;
};

const Context = createContext<ChannelShareIntentContextValue>({
  pendingShareIntent: null,
  pushShareIntent: () => {},
  popShareIntent: () => null,
});

export function useChannelShareIntent() {
  return useContext(Context);
}

export function ChannelShareIntentProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pendingShareIntentRef = useRef<QueuedChannelShareIntent | null>(null);
  const [pendingShareIntent, setPendingShareIntent] =
    useState<QueuedChannelShareIntent | null>(null);

  const pushShareIntent = useCallback(
    (shareIntent: QueuedChannelShareIntent) => {
      pendingShareIntentRef.current = shareIntent;
      setPendingShareIntent(shareIntent);
    },
    []
  );

  const popShareIntent = useCallback((channelId: string) => {
    const pendingShare = pendingShareIntentRef.current;
    if (!pendingShare || pendingShare.channelId !== channelId) {
      return null;
    }

    pendingShareIntentRef.current = null;
    setPendingShareIntent(null);

    return pendingShare.shareIntent;
  }, []);

  const value = useMemo(
    () => ({
      pendingShareIntent,
      pushShareIntent,
      popShareIntent,
    }),
    [pendingShareIntent, pushShareIntent, popShareIntent]
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}
