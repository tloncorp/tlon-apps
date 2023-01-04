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
  DiaryLetter,
  DiaryStory,
  DiarySaid,
  DiaryUpdate,
} from '@/types/diary';
import api from '@/api';
import {
  createStorageKey,
  clearStorageMigration,
  storageVersion,
  nestToFlag,
} from '@/logic/utils';
import { getPreviewTracker } from '@/logic/subscriptionTracking';
import { DiaryState } from './type';
import makeNotesStore from './notes';
import useSubscriptionState from '../subscription';

setAutoFreeze(false);

function subscribeOnce<T>(app: string, path: string) {
  return new Promise<T>((resolve) => {
    api.subscribe({
      app,
      path,
      event: resolve,
    });
  });
}

function diaryAction(flag: DiaryFlag, diff: DiaryDiff) {
  return {
    app: 'diary',
    mark: 'diary-action-0',
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
      loadedNotes: {},
      briefs: {},
      pendingImports: {},
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
        const story: DiaryStory = { block: [], inline: content };
        const memo: DiaryMemo = {
          content: story,
          author: window.our,
          sent: Date.now(),
        };
        const diff: DiaryDiff = {
          notes: {
            time: replying,
            delta: {
              quips: {
                time: decToUd(unixToDa(Date.now()).toString()),
                delta: {
                  add: memo,
                },
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

        const pendingImports = await api.scry<Record<string, boolean>>({
          app: 'diary',
          path: '/imp',
        });

        get().batchSet((draft) => {
          draft.pendingImports = pendingImports;
        });

        api.subscribe({
          app: 'diary',
          path: '/imp',
          event: (imports: Record<string, boolean>) => {
            get().batchSet((draft) => {
              draft.pendingImports = imports;
            });
          },
        });
      },
      fetchNote: async (flag, noteId) => {
        const note = await api.scry<DiaryNote>({
          app: 'diary',
          path: `/diary/${flag}/notes/note/${decToUd(noteId)}`,
        });
        note.type = 'note';
        note.seal.quips = new BigIntOrderedMap<DiaryQuip>().gas(
          Object.entries(note.seal.quips).map(([t, q]: any) => [
            bigInt(udToDec(t)),
            q,
          ])
        );
        get().batchSet((draft) => {
          draft.notes[flag] = draft.notes[flag].set(bigInt(noteId), note);
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
      addNote: async (flag, essay) =>
        new Promise<string>((resolve, reject) => {
          api.poke({
            ...diaryNoteDiff(flag, decToUd(unixToDa(Date.now()).toString()), {
              add: essay,
            }),
            onError: () => reject(),
            onSuccess: async () => {
              let timePosted = '';

              await useSubscriptionState
                .getState()
                .track(`diary/diary/${flag}/ui`, (event: DiaryUpdate) => {
                  const { time, diff } = event;
                  if ('notes' in diff) {
                    const { delta } = diff.notes;
                    if ('add' in delta && delta.add.sent === essay.sent) {
                      timePosted = time;
                      return true;
                    }
                  }

                  return false;
                });

              resolve(timePosted);
            },
          });
        }),
      editNote: async (flag, time, essay) => {
        await api.poke(
          diaryNoteDiff(flag, decToUd(time), {
            edit: essay,
          })
        );
      },
      delNote: async (flag, time) => {
        await api.poke(diaryNoteDiff(flag, time, { del: null }));
      },
      create: async (req) => {
        await new Promise<void>((resolve, reject) => {
          api.poke({
            app: 'diary',
            mark: 'diary-create',
            json: req,
            onError: () => reject(),
            onSuccess: async () => {
              await useSubscriptionState
                .getState()
                .track('diary/ui', (event) => {
                  const { update, flag } = event;
                  if (
                    'create' in update.diff &&
                    flag === `${req.group.split('/')[0]}/${req.name}`
                  ) {
                    return true;
                  }
                  return false;
                });
              resolve();
            },
          });
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
      getOlderNotes: async (flag: string, count: number) => {
        await makeNotesStore(
          flag,
          get,
          `/diary/${flag}/notes`,
          `/diary/${flag}/ui`
        ).getOlder(count.toString());
      },
      getNewerNotes: async (flag: string, count: number) => {
        await makeNotesStore(
          flag,
          get,
          `/diary/${flag}/notes`,
          `/diary/${flag}/ui`
        ).getNewer(count.toString());
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

export function useNotesForDiary(
  flag: DiaryFlag
): BigIntOrderedMap<DiaryLetter> {
  const def = useMemo(() => new BigIntOrderedMap<DiaryLetter>(), []);
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

export function useAllNotes() {
  return useDiaryState(useCallback((s: DiaryState) => s.notes, []));
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
  type: 'note',
  seal: { time: '', feels: {}, quips: new BigIntOrderedMap<DiaryQuip>() },
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
        const fallback = [bigInt(0), emptyNote] as const;
        if (!notes) {
          return fallback;
        }

        const t = bigInt(time);
        const note = notes.get(t);
        if (!note) {
          return fallback;
        }
        if (note.type === 'outline') {
          return fallback;
        }
        return [t, note] as const;
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

// TODO: this is a WIP part of implementing sorting by most recent comment
// export function useDiaryQuips(flag: string): [bigInt.BigInteger, DiaryQuipMap][] {
//   const def = useMemo(() => new BigIntOrderedMap<DiaryQuipMap>(), []);
//   const notes = useNotesForDiary(flag);
//   const getQuip = useQuips;
//   const quipNotes = Array.from(notes).map(([time, note]) => [time, getQuip(flag, time.toString())]);
// }

export function useGetLatestNote() {
  const def = useMemo(() => new BigIntOrderedMap<DiaryLetter>(), []);
  const empty = [bigInt(), null];
  const allNotes = useAllNotes();

  return (chFlag: string) => {
    const noteFlag = chFlag.startsWith('~') ? chFlag : nestToFlag(chFlag)[1];
    const notes = allNotes[noteFlag] ?? def;
    return notes.size > 0 ? notes.peekLargest() : empty;
  };
}

(window as any).diary = useDiaryState.getState;

export function useDiaryDisplayMode(flag: string): DiaryDisplayMode {
  const diary = useDiary(flag);
  return diary?.view ?? 'grid';
}

const { shouldLoad, newAttempt, finished } = getPreviewTracker();

const selRefs = (s: DiaryState) => s.loadedNotes;
export function useRemoteOutline(
  flag: string,
  time: string,
  blockLoad: boolean
) {
  const refs = useDiaryState(selRefs);
  const path = `/said/${flag}/note/${decToUd(time)}`;
  const cached = refs[path];

  useEffect(() => {
    if (!blockLoad && shouldLoad(path)) {
      newAttempt(path);
      subscribeOnce<DiarySaid>('diary', path)
        .then(({ outline }) => {
          useDiaryState.getState().batchSet((draft) => {
            draft.loadedNotes[path] = outline;
          });
        })
        .finally(() => finished(path));
    }
  }, [path, blockLoad]);

  return cached;
}
