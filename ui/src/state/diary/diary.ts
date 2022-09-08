import bigInt, { BigInteger } from 'big-integer';
import { unstable_batchedUpdates as batchUpdates } from 'react-dom';
import _ from 'lodash';
import create from 'zustand';
import { persist } from 'zustand/middleware';
import produce, { setAutoFreeze } from 'immer';
import { BigIntOrderedMap, decToUd, udToDec, unixToDa } from '@urbit/api';
import { useCallback, useEffect, useMemo } from 'react';
import {
  NoteDelta,
  Diary,
  DiaryBriefs,
  DiaryBriefUpdate,
  DiaryNote,
  DiaryDiff,
  DiaryFlag,
  DiaryPerm,
  Shelf,
  DiaryMemo,
  DiaryQuipMap,
  DiaryQuips,
  DiaryQuip,
  DiaryAction,
  DiaryDisplayMode,
} from '@/types/diary';
import api from '@/api';
import {
  createStorageKey,
  clearStorageMigration,
  storageVersion,
} from '@/logic/utils';
import { DiaryState } from './type';
import makeNotesStore from './notes';

setAutoFreeze(false);

function diaryAction(flag: DiaryFlag, diff: DiaryDiff) {
  return {
    app: 'diary',
    mark: 'diary-action',
    json: {
      flag,
      update: {
        time: '',
        diff,
      },
    },
  };
}

function diaryNoteDiff(flag: DiaryFlag, time: string, delta: NoteDelta) {
  return diaryAction(flag, {
    notes: {
      time,
      delta,
    },
  });
}

function getTime() {
  return decToUd(unixToDa(Date.now()).toString());
}

export const useDiaryState = create<DiaryState>(
  persist<DiaryState>(
    (set, get) => ({
      set: (fn) => {
        set(produce(get(), fn));
      },
      batchSet: (fn) => {
        batchUpdates(() => {
          get().set(fn);
        });
      },
      shelf: {},
      notes: {},
      banter: {},
      diarySubs: [],
      briefs: {},
      markRead: async (flag) => {
        await api.poke({
          app: 'diary',
          mark: 'diary-remark-action',
          json: {
            flag,
            diff: { read: null },
          },
        });
      },
      addQuip: async (flag, noteId, content) => {
        const replying = decToUd(noteId);
        const memo: DiaryMemo = {
          replying,
          content,
          author: window.our,
          sent: Date.now(),
        };
        const diff: DiaryDiff = {
          quips: {
            id: replying,
            diff: {
              time: decToUd(unixToDa(Date.now()).toString()),
              delta: {
                add: memo,
              },
            },
          },
        };

        await api.poke(diaryAction(flag, diff));
      },
      start: async () => {
        // TODO: parallelise
        api
          .scry<DiaryBriefs>({
            app: 'diary',
            path: '/briefs',
          })
          .then((briefs) => {
            get().batchSet((draft) => {
              draft.briefs = briefs;
            });
          });

        api
          .scry<Shelf>({
            app: 'diary',
            path: '/shelf',
          })
          .then((shelf) => {
            get().batchSet((draft) => {
              draft.shelf = shelf;
            });
          });

        api.subscribe({
          app: 'diary',
          path: '/briefs',
          event: (event: unknown, mark: string) => {
            if (mark === 'diary-leave') {
              get().batchSet((draft) => {
                delete draft.briefs[event as string];
              });
              return;
            }

            const { flag, brief } = event as DiaryBriefUpdate;
            get().batchSet((draft) => {
              draft.briefs[flag] = brief;
            });
          },
        });

        api.subscribe({
          app: 'diary',
          path: '/ui',
          event: (event: DiaryAction) => {
            get().batchSet((draft) => {
              const {
                flag,
                update: { diff },
              } = event;
              const diary = draft.shelf[flag];

              if ('view' in diff) {
                diary.view = diff.view;
              } else if ('del-sects' in diff) {
                diary.perms.writers = diary.perms.writers.filter(
                  (w) => !diff['del-sects'].includes(w)
                );
              } else if ('add-sects' in diff) {
                diary.perms.writers = diary.perms.writers.concat(
                  diff['add-sects']
                );
              }
            });
          },
        });
      },
      fetchQuips: async (flag, noteId) => {
        const id = decToUd(noteId);
        const res = await api.scry<DiaryQuips>({
          app: 'diary',
          path: `/diary/${flag}/quips/${id}/all`,
        });

        get().batchSet((draft) => {
          const map = new BigIntOrderedMap<DiaryQuip>().gas(
            _.map(res, (val, key) => {
              const k = bigInt(udToDec(key));
              return [k, val];
            })
          );

          if (!(flag in draft.banter)) {
            draft.banter[flag] = {};
          }

          draft.banter[flag][noteId] = map;
        });
      },
      joinDiary: async (flag) => {
        await api.poke({
          app: 'diary',
          mark: 'flag',
          json: flag,
        });
      },
      leaveDiary: async (flag) => {
        await api.poke({
          app: 'diary',
          mark: 'diary-leave',
          json: flag,
        });
      },
      viewDiary: async (flag, view) => {
        await api.poke(diaryAction(flag, { view }));
      },
      addNote: async (flag, heart) => {
        await api.poke(
          diaryNoteDiff(flag, decToUd(unixToDa(Date.now()).toString()), {
            add: heart,
          })
        );
      },
      delNote: (flag, time) => {
        api.poke(diaryNoteDiff(flag, time, { del: null }));
      },
      create: async (req) => {
        await api.poke({
          app: 'diary',
          mark: 'diary-create',
          json: req,
        });
      },
      addSects: async (flag, sects) => {
        await api.poke(diaryAction(flag, { 'add-sects': sects }));
        const perms = await api.scry<DiaryPerm>({
          app: 'diary',
          path: `/diary/${flag}/perm`,
        });
        get().batchSet((draft) => {
          draft.shelf[flag].perms = perms;
        });
      },
      delSects: async (flag, sects) => {
        await api.poke(diaryAction(flag, { 'del-sects': sects }));
        const perms = await api.scry<DiaryPerm>({
          app: 'diary',
          path: `/diary/${flag}/perm`,
        });
        get().batchSet((draft) => {
          draft.shelf[flag].perms = perms;
        });
      },
      initialize: async (flag) => {
        if (get().diarySubs.includes(flag)) {
          return;
        }

        const perms = await api.scry<DiaryPerm>({
          app: 'diary',
          path: `/diary/${flag}/perm`,
        });
        get().batchSet((draft) => {
          const diary = { perms, view: 'list' as DiaryDisplayMode };
          draft.shelf[flag] = diary;
          draft.diarySubs.push(flag);
        });

        await makeNotesStore(
          flag,
          get,
          `/diary/${flag}/notes`,
          `/diary/${flag}/ui`
        ).initialize();
      },
    }),
    {
      name: createStorageKey('diary'),
      version: storageVersion,
      migrate: clearStorageMigration,
      partialize: ({ shelf }) => ({
        shelf,
      }),
    }
  )
);

export function useNotesForDiary(flag: DiaryFlag) {
  const def = useMemo(() => new BigIntOrderedMap<DiaryNote>(), []);
  return useDiaryState(useCallback((s) => s.notes[flag] || def, [flag, def]));
}

const defaultPerms = {
  writers: [],
};

export function useDiaryPerms(flag: DiaryFlag) {
  return useDiaryState(
    useCallback((s) => s.shelf[flag]?.perms || defaultPerms, [flag])
  );
}

export function useDiaryIsJoined(flag: DiaryFlag) {
  return useDiaryState(
    useCallback((s) => Object.keys(s.briefs).includes(flag), [flag])
  );
}

export function useNotes(flag: DiaryFlag) {
  return useDiaryState(useCallback((s) => s.notes[flag], [flag]));
}

export function useCurrentNotesSize(flag: DiaryFlag) {
  return useDiaryState(useCallback((s) => s.notes[flag]?.size ?? 0, [flag]));
}

// export function useComments(flag: DiaryFlag, time: string) {
//   const notes = useNotes(flag);
//   return useMemo(() => {
//     if (!notes) {
//       return new BigIntOrderedMap<DiaryNote>();
//     }

//     const curio = notes.get(bigInt(time));
//     const replies = (curio?.seal?.replied || ([] as number[]))
//       .map((r: number) => {
//         const t = bigInt(r);
//         const c = notes.get(t);
//         return c ? ([t, c] as const) : undefined;
//       })
//       .filter((r: unknown): r is [BigInteger, DiaryNote] => !!r) as [
//       BigInteger,
//       DiaryNote
//     ][];
//     return new BigIntOrderedMap<DiaryNote>().gas(replies);
//   }, [notes, time]);
// }

const emptyNote: DiaryNote = {
  seal: { time: '', feels: {} },
  essay: {
    title: '',
    image: '',
    content: [],
    author: window.our || '',
    sent: Date.now(),
  },
};

export function useNote(
  flag: DiaryFlag,
  time: string
): readonly [bigInt.BigInteger, DiaryNote] {
  return useDiaryState(
    useCallback(
      (s) => {
        const notes = s.notes[flag];
        if (!notes) {
          return [bigInt(0), emptyNote];
        }

        const t = bigInt(time);
        return [t, notes.get(t)] as const;
      },
      [flag, time]
    )
  );
}

export function useDiary(flag: DiaryFlag): Diary | undefined {
  return useDiaryState(useCallback((s) => s.shelf[flag], [flag]));
}

export function useBriefs() {
  return useDiaryState(useCallback((s: DiaryState) => s.briefs, []));
}

export function useBrief(flag: string) {
  return useDiaryState(useCallback((s: DiaryState) => s.briefs[flag], [flag]));
}

export function useQuips(flag: string, noteId: string): DiaryQuipMap {
  useEffect(() => {
    useDiaryState.getState().fetchQuips(flag, noteId);
  }, [flag, noteId]);

  return useDiaryState(
    useCallback(
      (s) => s.banter[flag]?.[noteId] || new BigIntOrderedMap(),
      [flag, noteId]
    )
  );
}
(window as any).diary = useDiaryState.getState;

export function useDiaryDisplayMode(flag: string): DiaryDisplayMode {
  const diary = useDiary(flag);
  return diary?.view ?? 'grid';
}
