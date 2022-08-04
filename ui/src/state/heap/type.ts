import {
  CurioHeart,
  Heap,
  HeapBriefs,
  HeapCreate,
  HeapCurioMap,
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
  create: (req: HeapCreate) => Promise<void>;
  start: () => Promise<void>;
  initialize: (flag: HeapFlag) => Promise<void>;
  joinHeap: (flag: HeapFlag) => Promise<void>;
  leaveHeap: (flag: HeapFlag) => Promise<void>;
  markRead: (flag: HeapFlag) => Promise<void>;
  addCurio: (flag: HeapFlag, heart: CurioHeart) => void;
  delCurio: (flag: HeapFlag, time: number) => void;
  addSects: (flag: HeapFlag, writers: string[]) => Promise<void>;
  delSects: (flag: HeapFlag, writers: string[]) => Promise<void>;
}
