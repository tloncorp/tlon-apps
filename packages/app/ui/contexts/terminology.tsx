import { createContext, useContext, useMemo } from 'react';

import { useChannelContext } from './channel';

const termContext = createContext<{ post: 'post' | 'message' } | null>(null);

// You can rely on the Channel context to automatically populate terminology,
// or you can explicitly provide a context to override behavior.
export const TerminologyProvider = termContext.Provider;

export function usePostTerminology(): 'post' | 'message' {
  const channel = useChannelContext();
  const terminology = useContext(termContext);

  return useMemo(() => {
    if (terminology != null) {
      return terminology.post;
    }
    switch (channel.type) {
      case 'dm':
      case 'chat':
      case 'groupDm':
        return 'message';
      case 'notebook':
      case 'gallery':
        return 'post';
    }
  }, [terminology, channel.type]);
}
