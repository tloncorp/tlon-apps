import {
  Diary,
  DiaryBriefs,
  DiaryCreate,
  DiaryFlag,
  DiaryNoteMap,
  NoteEssay,
} from '@/types/diary';

export interface DiaryState {
  set: (fn: (sta: DiaryState) => void) => void;
  batchSet: (fn: (sta: DiaryState) => void) => void;
  shelf: {
    [flag: string]: Diary;
  };
  diarySubs: string[];
  notes: {
    [flag: DiaryFlag]: DiaryNoteMap;
  };
  briefs: DiaryBriefs;
  create: (req: DiaryCreate) => Promise<void>;
  start: () => Promise<void>;
  initialize: (flag: DiaryFlag) => Promise<void>;
  joinDiary: (flag: DiaryFlag) => Promise<void>;
  leaveDiary: (flag: DiaryFlag) => Promise<void>;
  markRead: (flag: DiaryFlag) => Promise<void>;
  addNote: (flag: DiaryFlag, essay: NoteEssay) => void;
  delNote: (flag: DiaryFlag, time: number) => void;
  addSects: (flag: DiaryFlag, writers: string[]) => Promise<void>;
  delSects: (flag: DiaryFlag, writers: string[]) => Promise<void>;
}
