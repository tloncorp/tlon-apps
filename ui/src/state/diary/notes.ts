import bigInt from 'big-integer';
import { BigIntOrderedMap, decToUd, udToDec } from '@urbit/api';
import { INITIAL_MESSAGE_FETCH_PAGE_SIZE } from '@/constants';
import {
  NoteSeal,
  DiaryNote,
  DiaryNotes,
  DiaryFlag,
  DiaryUpdate,
  DiaryOutlines,
  DiaryLetter,
  DiaryQuip,
} from '@/types/diary';
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
      const notes = await scry<DiaryOutlines>(
        `/newest/${INITIAL_MESSAGE_FETCH_PAGE_SIZE}/outline`
      );
      const sta = get();
      sta.batchSet((draft) => {
        let noteMap = new BigIntOrderedMap<DiaryLetter>();

        Object.keys(notes).forEach((key) => {
          const note = notes[key];
          note.type = 'outline';
          const tim = bigInt(udToDec(key));
          noteMap = noteMap.set(tim, note);
        });

        draft.notes[flag] = noteMap;
      });

      api.subscribe({
        app: 'diary',
        path: subPath,
        event: (data: DiaryUpdate) => {
          const { time: addTime, diff: d } = data;
          if ('notes' in d) {
            const { time, delta } = d.notes;
            const noteId = udToDec(time);
            const bigTime = bigInt(noteId);
            const s = get();
            s.batchSet((draft) => {
              let noteMap = draft.notes[flag];
              if ('add' in delta) {
                const seal: NoteSeal = {
                  time: noteId,
                  feels: {},
                  quips: new BigIntOrderedMap<DiaryQuip>(),
                };
                const note: DiaryNote = {
                  type: 'note',
                  seal,
                  essay: delta.add,
                };
                noteMap = noteMap.set(bigInt(udToDec(addTime)), note);
              } else if ('edit' in delta && noteMap.has(bigTime)) {
                const note = noteMap.get(bigTime);
                if (!note) {
                  return;
                }
                if (note.type === 'outline') {
                  return;
                }
                noteMap = noteMap.set(bigTime, { ...note, essay: delta.edit });
              } else if ('del' in delta && noteMap.has(bigTime)) {
                noteMap = noteMap.delete(bigTime);
              } else if ('quips' in delta) {
                const { time: quipId, delta: quipDel } = delta.quips;
                // const { delta, time: quipId } = diff;
                const k = bigInt(udToDec(quipId));
                const note = noteMap.get(bigTime);
                if (!note) {
                  return;
                }

                // TODO: check consistency if comments are unloaded?
                if ('add' in quipDel) {
                  if (note.type === 'outline') {
                    note.quipCount += 1;
                    noteMap.set(bigTime, note);
                  } else {
                    const quip = {
                      cork: {
                        time: quipId,
                        feels: {},
                      },
                      memo: quipDel.add,
                    };
                    note.seal.quips = note.seal.quips.set(k, quip);
                    noteMap.set(bigTime, note);
                  }
                } else if ('del' in delta) {
                  if (note.type === 'outline') {
                    note.quipCount -= 1;
                    noteMap.set(bigTime, note);
                  } else {
                    note.seal.quips.delete(k);
                  }
                }
              }

              draft.notes[flag] = noteMap;
            });
          }
        },
      });
    },
    getNewer: async (count: string) => getMessages('newer', count),
    getOlder: async (count: string) => getMessages('older', count),
  };
}
