import {
  NoteDiff,
  NoteSeal,
  DiaryNote,
  DiaryNotes,
  DiaryFlag,
  DiaryDiff,
  DiaryUpdate,
} from '@/types/diary';
import { BigIntOrderedMap, decToUd, udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import api from '../../api';
import { DiaryState } from './type';

interface NotesStore {
  initialize: () => Promise<void>;
  getNewer: (count: string) => Promise<boolean>;
  getOlder: (count: string) => Promise<boolean>;
}

export default function makeNotesStore(
  flag: DiaryFlag,
  get: () => DiaryState,
  scryPath: string,
  subPath: string
): NotesStore {
  const scry = <T>(path: string) =>
    api.scry<T>({
      app: 'diary',
      path: `${scryPath}${path}`,
    });

  const getMessages = async (dir: 'older' | 'newer', count: string) => {
    const { notes } = get();
    let noteMap = notes[flag];

    const oldNotesSize = noteMap.size ?? 0;
    if (oldNotesSize === 0) {
      // already loading the graph
      return false;
    }

    const index =
      dir === 'newer'
        ? noteMap.peekLargest()?.[0]
        : noteMap.peekSmallest()?.[0];
    if (!index) {
      return false;
    }

    const fetchStart = decToUd(index.toString());

    const newNotes = await api.scry<DiaryNotes>({
      app: 'diary',
      path: `${scryPath}/${dir}/${fetchStart}/${count}`,
    });

    get().batchSet((draft) => {
      Object.keys(newNotes).forEach((key) => {
        const note = newNotes[key];
        const tim = bigInt(udToDec(key));
        noteMap = noteMap.set(tim, note);
      });
      draft.notes[flag] = noteMap;
    });

    const newMessageSize = get().notes[flag].size;
    return dir === 'newer'
      ? newMessageSize !== oldNotesSize
      : newMessageSize === oldNotesSize;
  };

  return {
    initialize: async () => {
      const notes = await scry<DiaryNotes>(`/newest/100`);
      const sta = get();
      sta.batchSet((draft) => {
        let noteMap = new BigIntOrderedMap<DiaryNote>();

        Object.keys(notes).forEach((key) => {
          const note = notes[key];
          const tim = bigInt(udToDec(key));
          noteMap = noteMap.set(tim, note);
        });

        draft.notes[flag] = noteMap;
      });

      api.subscribe({
        app: 'diary',
        path: subPath,
        event: (data: DiaryUpdate) => {
          const { diff: d, time } = data;
          if ('notes' in d) {
            const { time: noteId, delta } = d.notes;
            const bigTime = bigInt(udToDec(noteId));
            const s = get();
            s.batchSet((draft) => {
              let noteMap = draft.notes[flag];
              if ('add' in delta && !noteMap.has(bigTime)) {
                const seal: NoteSeal = { time: noteId, feels: {} };
                const note: DiaryNote = { seal, essay: delta.add };
                noteMap = noteMap.set(bigTime, note);
              } else if ('del' in delta && noteMap.has(bigTime)) {
                noteMap = noteMap.delete(bigTime);
              }
              draft.notes[flag] = noteMap;
            });
          } else if ('quips' in d) {
            const { id: noteIdDec, diff } = d.quips;
            const noteId = udToDec(noteIdDec);
            const { delta, time: quipId } = diff;
            const k = bigInt(udToDec(quipId));
            const s = get();
            // TODO: check consistency if comments are unloaded?
            if ('add' in delta) {
              s.batchSet((draft) => {
                if (!(flag in draft.banter)) {
                  draft.banter[flag] = {};
                }
                if (!(noteId in draft.banter[flag])) {
                  draft.banter[flag][noteId] = new BigIntOrderedMap();
                }
                const quip = {
                  seal: {
                    time: quipId,
                    feels: {},
                  },
                  memo: delta.add,
                };
                draft.banter[flag][noteId] = draft.banter[flag][noteId].set(
                  k,
                  quip
                );
              });
            } else if ('del' in delta) {
              s.batchSet((draft) => {
                draft.banter[flag][noteId] =
                  draft.banter[flag][noteId].delete(k);
              });
            }
          }
        },
      });
    },
    getNewer: async (count: string) => getMessages('newer', count),
    getOlder: async (count: string) => getMessages('older', count),
  };
}
