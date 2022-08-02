import { ChannelCreate } from '@/types/channel';
import {
  CurioHeart,
  Heap,
  HeapBriefs,
  HeapCurioMap,
  HeapCurios,
  HeapFlag,
} from '@/types/heap';

export interface HeapState {
  set: (fn: (sta: HeapState) => void) => void;
  batchSet: (fn: (sta: HeapState) => void) => void;
  stash: {
    [flag: string]: Heap;
  };
  heapSubs: string[];
  curios: {
    [flag: HeapFlag]: HeapCurioMap;
  };
  briefs: HeapBriefs;
  markRead: (flag: HeapFlag) => Promise<void>;
  start: () => Promise<void>;
  joinHeap: (flag: HeapFlag) => Promise<void>;
  leaveHeap: (flag: HeapFlag) => Promise<void>;
  sendMessage: (flag: HeapFlag, heart: CurioHeart) => void;
  delMessage: (flag: HeapFlag, time: string) => void;
  addSects: (flag: HeapFlag, writers: string[]) => Promise<void>;
  delSects: (flag: HeapFlag, writers: string[]) => Promise<void>;
  create: (req: ChannelCreate) => Promise<void>;
  initialize: (flag: HeapFlag) => Promise<void>;
}
