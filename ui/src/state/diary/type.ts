export interface DiaryState {
  set: (fn: (sta: DiaryState) => void) => void;
  batchSet: (fn: (sta: DiaryState) => void) => void;
  pendingNotes: string[];
  pendingImports: Record<string, boolean>;
  initImports: (init: Record<string, boolean>) => void;
  [key: string]: unknown;
}
