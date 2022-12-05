import _ from 'lodash';
import { useChatState } from '@/state/chat';
import { useDiaryState } from '@/state/diary';
import { useHeapState } from '@/state/heap/heap';
import { useMemo } from 'react';

interface ChannelAgent {
  pendingImports: Record<string, boolean>;
}

const selPendImports = (s: ChannelAgent) => s.pendingImports;

export default function usePendingImports() {
  const chats = useChatState(selPendImports);
  const heaps = useHeapState(selPendImports);
  const diaries = useDiaryState(selPendImports);

  return useMemo(
    () => ({
      ..._.mapKeys(chats, (v, c) => `chat/${c}`),
      ..._.mapKeys(heaps, (v, h) => `heap/${h}`),
      ..._.mapKeys(diaries, (v, d) => `diary/${d}`),
    }),
    [chats, heaps, diaries]
  );
}
