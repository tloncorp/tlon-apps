import { Inline } from '@/types/content';
import {
  Diary,
  DiaryBriefs,
  DiaryCreate,
  DiaryDisplayMode,
  DiaryFlag,
  DiaryNoteMap,
  DiaryQuipMap,
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
  banter: {
    [flag: DiaryFlag]: {
      [noteId: string]: DiaryQuipMap;
    };
  };
  briefs: DiaryBriefs;
  create: (req: DiaryCreate) => Promise<void>;
  start: () => Promise<void>;
  fetchQuips: (flag: DiaryFlag, noteId: string) => Promise<void>;
  initialize: (flag: DiaryFlag) => Promise<void>;
  joinDiary: (flag: DiaryFlag) => Promise<void>;
  leaveDiary: (flag: DiaryFlag) => Promise<void>;
  viewDiary: (flag: DiaryFlag, view: DiaryDisplayMode) => Promise<void>;
  markRead: (flag: DiaryFlag) => Promise<void>;
  addNote: (flag: DiaryFlag, essay: NoteEssay) => void;
  editNote: (flag: DiaryFlag, essay: NoteEssay) => Promise<void>;
  delNote: (flag: DiaryFlag, time: string) => Promise<void>;
  addSects: (flag: DiaryFlag, writers: string[]) => Promise<void>;
  delSects: (flag: DiaryFlag, writers: string[]) => Promise<void>;
  addQuip: (
    flag: DiaryFlag,
    noteId: string,
    content: Inline[]
  ) => Promise<void>;
}
