import { useChat } from '@/state/chat';
import { useDiary } from '@/state/diary';
import { useHeap } from '@/state/heap/heap';
import { Chat } from '@/types/chat';
import { Diary } from '@/types/diary';
import { Heap } from '@/types/heap';
import { nestToFlag } from './utils';

export default function useChannel(
  nest: string
): Chat | Heap | Diary | undefined {
  const [app, flag] = nestToFlag(nest);
  const chat = useChat(flag);
  const heap = useHeap(flag);
  const diary = useDiary(flag);

  switch (app) {
    case 'chat':
      return chat;
    case 'heap':
      return heap;
    case 'diary':
      return diary;
    default:
      return undefined;
  }
}
