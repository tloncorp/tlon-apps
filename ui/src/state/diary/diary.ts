import bigInt from 'big-integer';
import { unstable_batchedUpdates as batchUpdates } from 'react-dom';
import produce, { setAutoFreeze } from 'immer';
import { BigIntOrderedMap, decToUd, udToDec, unixToDa } from '@urbit/api';
import { useMemo } from 'react';
import {
  MutationFunction,
  MutationOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  NoteDelta,
  Diary,
  DiaryNote,
  DiaryDiff,
  DiaryFlag,
  DiaryPerm,
  DiaryMemo,
  DiaryQuip,
  DiaryAction,
  DiaryDisplayMode,
  DiaryLetter,
  DiarySaid,
  DiaryUpdate,
  DiaryJoin,
  DiaryCreate,
  DiaryBriefs,
  DiaryOutline,
  NoteEssay,
  DiaryStory,
} from '@/types/diary';
import api from '@/api';
import { restoreMap } from '@/logic/utils';
import useReactQuerySubscription from '@/logic/useReactQuerySubscription';
import useReactQueryScry from '@/logic/useReactQueryScry';
import useReactQuerySubscribeOnce from '@/logic/useReactQuerySubscribeOnce';
import { INITIAL_MESSAGE_FETCH_PAGE_SIZE } from '@/constants';
import { DiaryState } from './type';
import { createState } from '../base';

setAutoFreeze(false);

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

export const useDiaryState = createState<DiaryState>(
  'diary',
  (set, get) => ({
    set: (fn) => {
      set(produce(get(), fn));
    },
    batchSet: (fn) => {
      batchUpdates(() => {
        get().set(fn);
      });
    },
    pendingImports: {},
    initImports: (init) => {
      get().batchSet((draft) => {
        draft.pendingImports = init;
      });
    },
  }),
  {},
  []
);

export function useNotes(flag: DiaryFlag): BigIntOrderedMap<DiaryLetter> {
  const { data, ...rest } = useReactQuerySubscription({
    queryKey: ['diary', 'notes', flag],
    app: 'diary',
    path: `/diary/${flag}/ui`,
    scry: `/diary/${flag}/notes/newest/${INITIAL_MESSAGE_FETCH_PAGE_SIZE}/outline`,
    priority: 2,
    options: {
      refetchOnReconnect: false,
    },
  });

  const def = new BigIntOrderedMap<DiaryLetter>();
  if (rest.isLoading || rest.isError || data === undefined) {
    return def;
  }

  let noteMap = restoreMap<DiaryLetter>(data);

  const diff = Object.entries(data as object).map(([k, v]) => ({
    tim: bigInt(udToDec(k)),
    note: v as DiaryLetter,
  }));

  diff.forEach(({ tim, note }) => {
    noteMap = noteMap.set(tim, note);
  });

  return noteMap as BigIntOrderedMap<DiaryLetter>;
}

export function useOlderNotes(flag: DiaryFlag, count: number, enabled = false) {
  const queryClient = useQueryClient();
  const notes = useNotes(flag);

  let noteMap =
    restoreMap<DiaryLetter>(notes) || new BigIntOrderedMap<DiaryLetter>();

  const index = noteMap.peekSmallest()?.[0];
  const oldNotesSize = noteMap.size ?? 0;

  const fetchStart = index ? decToUd(index.toString()) : decToUd('0');

  const { data, ...rest } = useReactQueryScry({
    queryKey: ['diary', 'notes', flag, 'older', fetchStart],
    app: 'diary',
    path: `/diary/${flag}/notes/older/${fetchStart}/${count}`,
    priority: 2,
    options: {
      enabled:
        enabled &&
        index !== undefined &&
        oldNotesSize !== 0 &&
        fetchStart !== decToUd('0'),
    },
  });

  if (
    rest.isError ||
    data === undefined ||
    Object.entries(data as object).length === 0 ||
    !enabled
  ) {
    return false;
  }

  const diff = Object.entries(data as object).map(([k, v]) => ({
    tim: bigInt(udToDec(k)),
    note: v as DiaryLetter,
  }));

  diff.forEach(({ tim, note }) => {
    noteMap = noteMap.set(tim, note);
  });

  queryClient.setQueryData(['diary', 'notes', flag], noteMap.root);

  return rest.isLoading;
}

const defaultPerms = {
  writers: [],
};

export function useDiaryPerms(flag: DiaryFlag) {
  const { data, ...rest } = useReactQueryScry({
    queryKey: ['diary', 'perms', flag],
    app: 'diary',
    path: `/diary/${flag}/perm`,
    priority: 2,
  });

  if (rest.isLoading || rest.isError || data === undefined) {
    return defaultPerms;
  }

  return data as DiaryPerm;
}

export function useNote(flag: DiaryFlag, noteId: string, disabled = false) {
  const { data, ...rest } = useReactQueryScry({
    queryKey: ['diary', 'notes', flag, noteId],
    app: 'diary',
    path: `/diary/${flag}/notes/note/${decToUd(noteId)}`,
    options: {
      enabled: noteId !== '0' && flag !== '' && !disabled,
    },
  });

  const note = data as DiaryNote;

  const quips = note?.seal?.quips;
  let quipMap: BigIntOrderedMap<DiaryQuip> = new BigIntOrderedMap<DiaryQuip>();

  if (quips !== undefined && quips !== null) {
    quipMap = restoreMap<DiaryQuip>(quips);
    const diff = Object.entries(quips as object).map(([k, v]) => ({
      tim: bigInt(udToDec(k)),
      quip: v as DiaryQuip,
    }));

    diff.forEach(({ tim, quip }) => {
      quipMap = quipMap.set(tim, quip);
    });
  }

  const noteWithQuips = {
    ...note,
    seal: {
      ...note?.seal,
      quips: quipMap,
    },
  };

  return {
    note: noteWithQuips as DiaryNote,
    ...rest,
  };
}

export function useQuip(
  flag: DiaryFlag,
  noteId: string,
  quipId: string,
  isScrolling = false
) {
  const { note } = useNote(flag, noteId, isScrolling);
  return useMemo(() => {
    if (note === undefined) {
      return undefined;
    }
    if (note.seal.quips.size === undefined) {
      return undefined;
    }
    const quip = note.seal.quips.get(bigInt(quipId));
    return quip;
  }, [note, quipId]);
}

export function useDiaries(): { [flag: string]: Diary } {
  const { data, ...rest } = useReactQuerySubscription({
    queryKey: ['diary', 'shelf'],
    app: 'diary',
    path: '/ui',
    scry: '/shelf',
  });

  if (rest.isLoading || rest.isError || data === undefined) {
    return {};
  }

  return data as { [flag: string]: Diary };
}

export function useDiary(flag: DiaryFlag): Diary | undefined {
  const shelf = useDiaries();

  return shelf[flag];
}

export function useDiaryBriefs(): DiaryBriefs {
  const { data, ...rest } = useReactQuerySubscription({
    queryKey: ['diary', 'briefs'],
    app: 'diary',
    path: '/briefs',
    scry: '/briefs',
  });

  if (rest.isLoading || rest.isError || data === undefined) {
    return {};
  }

  return data as DiaryBriefs;
}

export function useDiaryIsJoined(flag: DiaryFlag) {
  const briefs = useDiaryBriefs();

  return Object.keys(briefs).includes(flag);
}

export function useDiaryBrief(flag: string) {
  const briefs = useDiaryBriefs();

  return briefs[flag];
}

// TODO: this is a WIP part of implementing sorting by most recent comment
// export function useDiaryQuips(flag: string): [bigInt.BigInteger, DiaryQuipMap][] {
//   const def = useMemo(() => new BigIntOrderedMap<DiaryQuipMap>(), []);
//   const notes = useNotesForDiary(flag);
//   const getQuip = useQuips;
//   const quipNotes = Array.from(notes).map(([time, note]) => [time, getQuip(flag, time.toString())]);
// }

export function useDiaryDisplayMode(flag: string): DiaryDisplayMode {
  const diary = useDiary(flag);
  return diary?.view ?? 'list';
}

export function useRemoteOutline(
  flag: string,
  time: string,
  blockLoad: boolean
) {
  const path = `/said/${flag}/note/${decToUd(time)}`;
  const { data, ...rest } = useReactQuerySubscribeOnce({
    queryKey: ['diary', 'said', flag, time],
    app: 'diary',
    path,
    options: {
      enabled: !blockLoad,
    },
  });

  if (rest.isLoading || rest.isError || data === undefined) {
    return {} as DiaryOutline;
  }

  const { outline } = data as DiarySaid;

  return outline as DiaryOutline;
}

export function useDiaryMutation<TResponse>(
  mutationFn: MutationFunction<TResponse, any>,
  options?: MutationOptions<TResponse, unknown, any, unknown>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries(['diary', 'shelf']);
      await queryClient.cancelQueries(['diary', 'briefs']);
      await queryClient.cancelQueries(['diary', 'perms', variables.flag]);
      await queryClient.cancelQueries(['diary', 'notes', variables.flag]);
    },
    onSettled: async (_data, _error, variables) => {
      await queryClient.refetchQueries(['diary', 'shelf']);
      await queryClient.refetchQueries(['diary', 'briefs']);
      await queryClient.refetchQueries(['diary', 'perms', variables.flag]);
      await queryClient.refetchQueries(['diary', 'notes', variables.flag]);
    },
    ...options,
  });
}

export function useMarkReadDiaryMutation() {
  const mutationFn = async (variables: { flag: string }) => {
    await api.poke({
      app: 'diary',
      mark: 'diary-remark-action',
      json: {
        flag: variables.flag,
        diff: { read: null },
      },
    });
  };

  return useMutation({
    mutationFn,
  });
}

export function useJoinDiaryMutation() {
  const mutationFn = async (variables: { group: string; chan: string }) => {
    await api.trackedPoke<DiaryJoin, DiaryAction>(
      {
        app: 'diary',
        mark: 'channel-join',
        json: {
          group: variables.group,
          chan: variables.chan,
        },
      },
      { app: 'diary', path: '/ui' },
      (event) => event.flag === variables.chan && 'create' in event.update.diff
    );
  };

  return useMutation(mutationFn);
}

export function useLeaveDiaryMutation() {
  const mutationFn = async (variables: { flag: string }) => {
    await api.poke({
      app: 'diary',
      mark: 'diary-leave',
      json: variables.flag,
    });
  };

  return useDiaryMutation(mutationFn);
}

export function useViewDiaryMutation() {
  const queryClient = useQueryClient();
  const mutationFn = async (variables: {
    flag: string;
    view: DiaryDisplayMode;
  }) => {
    await api.poke(diaryAction(variables.flag, { view: variables.view }));
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries(['diary', 'shelf']);

      const prev = queryClient.getQueryData<{ [flag: string]: Diary }>([
        'diary',
        'shelf',
      ]);

      if (prev !== undefined) {
        queryClient.setQueryData<{ [flag: string]: Diary }>(
          ['diary', 'shelf'],
          {
            ...prev,
            [variables.flag]: {
              ...prev[variables.flag],
              view: variables.view,
            },
          }
        );
      }
    },
  });
}

export function useAddNoteMutation() {
  const queryClient = useQueryClient();
  let timePosted = '';
  const mutationFn = async (variables: { flag: DiaryFlag; essay: NoteEssay }) =>
    new Promise<string>((resolve, reject) => {
      api
        .trackedPoke<DiaryAction, DiaryUpdate>(
          diaryNoteDiff(
            variables.flag,
            decToUd(unixToDa(Date.now()).toString()),
            {
              add: variables.essay,
            }
          ),
          { app: 'diary', path: `/diary/${variables.flag}/ui` },
          (event) => {
            const { time, diff } = event;
            if ('notes' in diff) {
              const { delta } = diff.notes;
              if ('add' in delta && delta.add.sent === variables.essay.sent) {
                timePosted = time;
                return true;
              }
            }

            return false;
          }
        )
        .then(() => {
          resolve(timePosted);
        });
    });

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries(['diary', 'notes', variables.flag]);
      await queryClient.cancelQueries(['diary', 'briefs']);

      const notes = queryClient.getQueryData<DiaryLetter>([
        'diary',
        'notes',
        variables.flag,
      ]);

      if (notes !== undefined) {
        queryClient.setQueryData<DiaryLetter>(
          ['diary', 'notes', variables.flag],
          {
            ...notes,
            [timePosted]: variables.essay,
          }
        );
      }
    },
    onSettled: async (_data, _error, variables) => {
      await queryClient.refetchQueries(['diary', 'notes', variables.flag]);
      await queryClient.refetchQueries(['diary', 'briefs']);
    },
  });
}

export function useEditNoteMutation() {
  const queryClient = useQueryClient();
  const mutationFn = async (variables: {
    flag: DiaryFlag;
    time: string;
    essay: NoteEssay;
  }) => {
    await api.poke(
      diaryNoteDiff(variables.flag, decToUd(variables.time), {
        edit: variables.essay,
      })
    );
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries(['diary', 'notes', variables.flag]);
      await queryClient.cancelQueries([
        'diary',
        'notes',
        variables.flag,
        variables.time,
      ]);

      const notes = queryClient.getQueryData<Record<string, DiaryLetter>>([
        'diary',
        'notes',
        variables.flag,
      ]);
      const note = queryClient.getQueryData<DiaryLetter>([
        'diary',
        'notes',
        variables.flag,
        variables.time,
      ]);

      if (notes && note) {
        Object.keys(notes).forEach((key) => {
          if (
            key === decToUd(variables.time) &&
            notes[key].type === 'outline' &&
            'title' in notes[key]
          ) {
            (notes[key] as DiaryOutline).title = variables.essay.title;
            (notes[key] as DiaryOutline).image = variables.essay.image;
            (notes[key] as DiaryOutline).content = variables.essay.content;
          }
        });

        const newNote = {
          ...note,
          ...variables.essay,
        };

        queryClient.setQueryData(['diary', 'notes', variables.flag], notes);
        queryClient.setQueryData(
          ['diary', 'notes', variables.flag, variables.time],
          newNote
        );
      }
    },
    onSettled: async (_data, _error, variables) => {
      await queryClient.refetchQueries([
        'diary',
        'notes',
        variables.flag,
        variables.time,
      ]);
    },
  });
}

export function useDeleteNoteMutation() {
  const queryClient = useQueryClient();
  const mutationFn = async (variables: { flag: DiaryFlag; time: string }) => {
    await api.poke(
      diaryNoteDiff(variables.flag, variables.time, { del: null })
    );
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries(['diary', 'notes', variables.flag]);
      await queryClient.cancelQueries([
        'diary',
        'notes',
        variables.flag,
        variables.time,
      ]);

      const notes = queryClient.getQueryData<Record<string, DiaryLetter>>([
        'diary',
        'notes',
        variables.flag,
      ]);

      if (notes) {
        delete notes[decToUd(variables.time)];
        queryClient.setQueryData(['diary', 'notes', variables.flag], notes);
      }
    },
    onSettled: async (_data, _error, variables) => {
      await queryClient.refetchQueries(['diary', 'notes', variables.flag]);
    },
  });
}

export function useCreateDiaryMutation() {
  const queryClient = useQueryClient();

  const mutationFn = async (variables: DiaryCreate) => {
    await api.trackedPoke<DiaryCreate, DiaryAction>(
      {
        app: 'diary',
        mark: 'diary-create',
        json: variables,
      },
      { app: 'diary', path: '/ui' },
      (event) => {
        const { update, flag } = event;
        return (
          'create' in update.diff && flag === `${window.our}/${variables.name}`
        );
      }
    );
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries(['diary', 'shelf']);

      const prev = queryClient.getQueryData<{ [flag: string]: Diary }>([
        'diary',
        'shelf',
      ]);

      if (prev !== undefined) {
        queryClient.setQueryData<{ [flag: string]: Diary }>(
          ['diary', 'shelf'],
          {
            ...prev,
            [`${window.our}/${variables.name}`]: {
              perms: { writers: [], group: variables.group },
              view: 'list',
            },
          }
        );
      }
    },
    onSettled: async (_data, _error, variables) => {
      await queryClient.refetchQueries(['diary', 'shelf']);
      await queryClient.refetchQueries(['diary', 'notes', variables.name]);
    },
  });
}

export function useAddSectsDiaryMutation() {
  const queryClient = useQueryClient();
  const mutationFn = async (variables: {
    flag: DiaryFlag;
    writers: string[];
  }) => {
    await api.poke(
      diaryAction(variables.flag, { 'add-sects': variables.writers })
    );
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries(['diary', 'shelf']);

      const prev = queryClient.getQueryData<{ [flag: string]: Diary }>([
        'diary',
        'shelf',
      ]);

      if (prev !== undefined) {
        queryClient.setQueryData<{ [flag: string]: Diary }>(
          ['diary', 'shelf'],
          {
            ...prev,
            [variables.flag]: {
              ...prev[variables.flag],
              perms: {
                ...prev[variables.flag].perms,
                writers: [
                  ...prev[variables.flag].perms.writers,
                  ...variables.writers,
                ],
              },
            },
          }
        );
      }
    },
  });
}

export function useDeleteSectsDiaryMutation() {
  const queryClient = useQueryClient();
  const mutationFn = async (variables: {
    flag: DiaryFlag;
    writers: string[];
  }) => {
    await api.poke(
      diaryAction(variables.flag, { 'del-sects': variables.writers })
    );
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries(['diary', 'shelf']);

      const prev = queryClient.getQueryData<{ [flag: string]: Diary }>([
        'diary',
        'shelf',
      ]);

      if (prev !== undefined) {
        queryClient.setQueryData<{ [flag: string]: Diary }>(
          ['diary', 'shelf'],
          {
            ...prev,
            [variables.flag]: {
              ...prev[variables.flag],
              perms: {
                ...prev[variables.flag].perms,
                writers: prev[variables.flag].perms.writers.filter(
                  (writer) => !variables.writers.includes(writer)
                ),
              },
            },
          }
        );
      }
    },
  });
}

export function useAddQuipMutation() {
  const queryClient = useQueryClient();
  const mutationFn = async (variables: {
    flag: DiaryFlag;
    noteId: string;
    content: DiaryStory;
  }) => {
    const replying = decToUd(variables.noteId);
    // const story: DiaryStory = { block: [], inline: content };
    const memo: DiaryMemo = {
      content: variables.content,
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

    await api.poke(diaryAction(variables.flag, diff));
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries(['diary', 'notes', variables.flag]);
      await queryClient.cancelQueries([
        'diary',
        'notes',
        variables.flag,
        variables.noteId,
      ]);

      const notes = queryClient.getQueryData<Record<string, DiaryLetter>>([
        'diary',
        'notes',
        variables.flag,
      ]);

      if (notes) {
        const replying = decToUd(variables.noteId);
        if (replying in notes) {
          const replyingNote = notes[replying] as DiaryOutline;
          const updatedNote = {
            ...replyingNote,
            quipCount: replyingNote.quipCount + 1,
            quippers: [...replyingNote.quippers, window.our],
          };

          queryClient.setQueryData<Record<string, DiaryLetter>>(
            ['diary', 'notes', variables.flag],
            {
              ...notes,
              [replying]: updatedNote,
            }
          );
        }
      }

      const prevNote = queryClient.getQueryData<DiaryNote>([
        'diary',
        'notes',
        variables.flag,
        variables.noteId,
      ]);

      if (prevNote) {
        const prevQuips = prevNote.seal.quips.root;
        const newQuips = {
          ...prevQuips,
          [unixToDa(Date.now()).toString()]: variables.content,
        };

        const updatedNote: DiaryNote = {
          ...prevNote,
          seal: {
            ...prevNote.seal,
            quips: restoreMap(newQuips),
          },
        };
      }
    },
    onSettled: async (_data, _error, variables) => {
      await queryClient.refetchQueries(['diary', 'notes', variables.flag]);
      await queryClient.refetchQueries([
        'diary',
        'notes',
        variables.flag,
        variables.noteId,
      ]);
    },
  });
}

export function useDeleteQuipMutation() {
  const queryClient = useQueryClient();
  const mutationFn = async (variables: {
    flag: DiaryFlag;
    noteId: string;
    quipId: string;
  }) => {
    const diff: DiaryDiff = {
      notes: {
        time: decToUd(variables.noteId),
        delta: {
          quips: {
            time: decToUd(variables.quipId),
            delta: {
              del: null,
            },
          },
        },
      },
    };

    await api.poke(diaryAction(variables.flag, diff));
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries(['diary', 'notes', variables.flag]);

      const notes = queryClient.getQueryData<Record<string, DiaryLetter>>([
        'diary',
        'notes',
        variables.flag,
      ]);

      if (notes) {
        const replying = decToUd(variables.noteId);
        if (replying in notes) {
          const replyingNote = notes[replying] as DiaryOutline;
          const updatedNote = {
            ...replyingNote,
            quipCount: replyingNote.quipCount - 1,
            quippers: replyingNote.quippers.filter(
              (quipper) => quipper !== window.our
            ),
          };

          queryClient.setQueryData<Record<string, DiaryLetter>>(
            ['diary', 'notes', variables.flag],
            {
              ...notes,
              [replying]: updatedNote,
            }
          );
        }
      }
    },
  });
}

export function useAddNoteFeelMutation() {
  const queryClient = useQueryClient();
  const mutationFn = async (variables: {
    flag: DiaryFlag;
    noteId: string;
    feel: string;
  }) => {
    const diff: DiaryDiff = {
      notes: {
        time: decToUd(variables.noteId),
        delta: {
          'add-feel': {
            time: decToUd(unixToDa(Date.now()).toString()),
            feel: variables.feel,
            ship: window.our,
          },
        },
      },
    };

    await api.poke(diaryAction(variables.flag, diff));
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries([
        'diary',
        'notes',
        variables.flag,
        variables.noteId,
      ]);

      const prevNote = queryClient.getQueryData<DiaryNote>([
        'diary',
        'notes',
        variables.flag,
        variables.noteId,
      ]);

      if (prevNote) {
        const prevFeels = prevNote.seal.feels;
        const newFeels = {
          ...prevFeels,
          [unixToDa(Date.now()).toString()]: variables.feel,
        };

        const updatedNote: DiaryNote = {
          ...prevNote,
          seal: {
            ...prevNote.seal,
            feels: newFeels,
          },
        };

        queryClient.setQueryData<DiaryNote>(
          ['diary', 'notes', variables.flag, variables.noteId],
          updatedNote
        );
      }
    },
    onSettled: async (_data, _error, variables) => {
      await queryClient.refetchQueries(['diary', 'notes', variables.flag]);
      await queryClient.refetchQueries([
        'diary',
        'notes',
        variables.flag,
        variables.noteId,
      ]);
    },
  });
}

export function useDeleteNoteFeelMutation() {
  const queryClient = useQueryClient();
  const mutationFn = async (variables: { flag: DiaryFlag; noteId: string }) => {
    const diff: DiaryDiff = {
      notes: {
        time: decToUd(variables.noteId),
        delta: {
          'del-feel': window.our,
        },
      },
    };

    await api.poke(diaryAction(variables.flag, diff));
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries([
        'diary',
        'notes',
        variables.flag,
        variables.noteId,
      ]);

      const prevNote = queryClient.getQueryData<DiaryNote>([
        'diary',
        'notes',
        variables.flag,
        variables.noteId,
      ]);

      if (prevNote) {
        const prevFeels = prevNote.seal.feels;
        const newFeels = {
          ...prevFeels,
        };
        delete newFeels[window.our];

        const updatedNote: DiaryNote = {
          ...prevNote,
          seal: {
            ...prevNote.seal,
            feels: newFeels,
          },
        };

        queryClient.setQueryData<DiaryNote>(
          ['diary', 'notes', variables.flag, variables.noteId],
          updatedNote
        );
      }
    },
    onSettled: async (_data, _error, variables) => {
      await queryClient.refetchQueries(['diary', 'notes', variables.flag]);
      await queryClient.refetchQueries([
        'diary',
        'notes',
        variables.flag,
        variables.noteId,
      ]);
    },
  });
}

export function useAddQuipFeelMutation() {
  const queryClient = useQueryClient();
  const mutationFn = async (variables: {
    flag: DiaryFlag;
    noteId: string;
    quipId: string;
    feel: string;
  }) => {
    const diff: DiaryDiff = {
      notes: {
        time: decToUd(variables.noteId),
        delta: {
          quips: {
            time: decToUd(variables.quipId),
            delta: {
              'add-feel': {
                feel: variables.feel,
                ship: window.our,
              },
            },
          },
        },
      },
    };

    await api.poke(diaryAction(variables.flag, diff));
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries([
        'diary',
        'notes',
        variables.flag,
        variables.noteId,
      ]);

      const prevNote = queryClient.getQueryData<DiaryNote>([
        'diary',
        'notes',
        variables.flag,
        variables.noteId,
      ]);

      if (prevNote) {
        const prevQuips = prevNote.seal.quips;
        const newQuips = Array.from(prevQuips).map(([time, quip]) => {
          if (time.toString() === variables.quipId) {
            return {
              ...quip,
              cork: {
                feels: {
                  ...quip.cork.feels,
                  [window.our]: variables.feel,
                },
              },
            };
          }
          return quip;
        });

        const updatedNote = {
          ...prevNote,
          seal: {
            ...prevNote.seal,
            quips: newQuips,
          },
        };

        queryClient.setQueryData(
          ['diary', 'notes', variables.flag, variables.noteId],
          updatedNote
        );
      }
    },
    onSettled: async (_data, _error, variables) => {
      await queryClient.refetchQueries(['diary', 'notes', variables.flag]);
      await queryClient.refetchQueries([
        'diary',
        'notes',
        variables.flag,
        variables.noteId,
      ]);
    },
  });
}

export function useDeleteQuipFeelMutation() {
  const queryClient = useQueryClient();
  const mutationFn = async (variables: {
    flag: DiaryFlag;
    noteId: string;
    quipId: string;
  }) => {
    const diff: DiaryDiff = {
      notes: {
        time: decToUd(variables.noteId),
        delta: {
          quips: {
            time: decToUd(variables.quipId),
            delta: {
              'del-feel': window.our,
            },
          },
        },
      },
    };

    await api.poke(diaryAction(variables.flag, diff));
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries([
        'diary',
        'notes',
        variables.flag,
        variables.noteId,
      ]);

      const prevNote = queryClient.getQueryData<DiaryNote>([
        'diary',
        'notes',
        variables.flag,
        variables.noteId,
      ]);

      if (prevNote) {
        const prevQuips = prevNote.seal.quips;
        const newQuips = Array.from(prevQuips).map(([time, quip]) => {
          if (time.toString() === variables.quipId) {
            const newFeels = {
              ...quip.cork.feels,
            };
            delete newFeels[window.our];

            return {
              ...quip,
              cork: {
                ...quip.cork,
                feels: newFeels,
              },
            };
          }
          return quip;
        });

        const updatedNote = {
          ...prevNote,
          seal: {
            ...prevNote.seal,
            quips: newQuips,
          },
        };

        queryClient.setQueryData(
          ['diary', 'notes', variables.flag, variables.noteId],
          updatedNote
        );
      }
    },
    onSettled: async (_data, _error, variables) => {
      await queryClient.refetchQueries([
        'diary',
        'notes',
        variables.flag,
        variables.noteId,
      ]);
    },
  });
}
