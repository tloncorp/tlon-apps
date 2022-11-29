import { useChatState } from '@/state/chat';
import { useDiaryState } from '@/state/diary';
import { useHeapState } from '@/state/heap/heap';
import { useMemo } from 'react';

interface ChannelAgent {
  pendingImports: string[];
}

const selPendImports = (s: ChannelAgent) => s.pendingImports;

export default function usePendingImports() {
  const chats = useChatState(selPendImports);
  const heaps = useHeapState(selPendImports);
  const diaries = useDiaryState(selPendImports);

  return useMemo(
    () =>
      ([] as string[]).concat(
        chats.map((c) => `chat/${c}`),
        heaps.map((h) => `heap/${h}`),
        diaries.map((d) => `diary/${d}`)
      ),
    [chats, heaps, diaries]
  );
}
