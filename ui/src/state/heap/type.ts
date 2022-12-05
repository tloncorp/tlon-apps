import {
  CurioHeart,
  Heap,
  HeapBriefs,
  HeapCreate,
  HeapCurio,
  HeapCurioMap,
  HeapDisplayMode,
  HeapFlag,
} from '@/types/heap';

export interface HeapState {
  set: (fn: (sta: HeapState) => void) => void;
  batchSet: (fn: (sta: HeapState) => void) => void;
  stash: {
    [flag: string]: Heap;
  };
  heapSubs: string[];
  loadedRefs: {
    [path: string]: HeapCurio;
  };
  curios: {
    [flag: HeapFlag]: HeapCurioMap;
  };
  briefs: HeapBriefs;
  pendingImports: Record<string, boolean>;
  create: (req: HeapCreate) => Promise<void>;
  start: () => Promise<void>;
  initialize: (flag: HeapFlag) => Promise<void>;
  joinHeap: (flag: HeapFlag) => Promise<void>;
  leaveHeap: (flag: HeapFlag) => Promise<void>;
  viewHeap: (flag: HeapFlag, view: HeapDisplayMode) => Promise<void>;
  markRead: (flag: HeapFlag) => Promise<void>;
  addCurio: (flag: HeapFlag, heart: CurioHeart) => Promise<void>;
  delCurio: (flag: HeapFlag, time: string) => Promise<void>;
  editCurio: (flag: HeapFlag, time: string, heart: CurioHeart) => Promise<void>;
  addSects: (flag: HeapFlag, writers: string[]) => Promise<void>;
  delSects: (flag: HeapFlag, writers: string[]) => Promise<void>;
}
