import bigInt from 'big-integer';
import { BigIntOrderedMap, decToUd, udToDec, unixToDa } from '@urbit/api';
import { useMemo } from 'react';
import {
  QueryClient,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  NoteDelta,
  Ship,
  DiaryQuips,
  Diary,
  DiaryFlag,
  DiaryPerm,
  DiaryMemo,
  DiaryQuip,
  DiaryAction,
  DiaryDisplayMode,
  DiarySortMode,
  DiarySaid,
  DiaryCreate,
  DiaryBriefs,
  DiaryOutline,
  NoteEssay,
  DiaryStory,
  DiaryOutlines,
  DiaryShelfResponse,
  DiaryShelfAction,
} from '@/types/diary';
import api from '@/api';
import { restoreMap } from '@/logic/utils';
import useReactQuerySubscription from '@/logic/useReactQuerySubscription';
import useReactQueryScry from '@/logic/useReactQueryScry';
import useReactQuerySubscribeOnce from '@/logic/useReactQuerySubscribeOnce';
import { INITIAL_MESSAGE_FETCH_PAGE_SIZE } from '@/constants';
import { Poke } from '@urbit/http-api';
import create from 'zustand';

interface NoteSealInCache {
  time: string;
  quips: DiaryQuips;
  feels: {
    [ship: Ship]: string;
  };
}

interface DiaryNoteInCache {
  type: 'note';
  seal: NoteSealInCache;
  essay: NoteEssay;
}

async function updateNoteInCache(
  variables: { flag: DiaryFlag; noteId: string },
  updater: (note: DiaryNoteInCache | undefined) => DiaryNoteInCache | undefined,
  queryClient: QueryClient
) {
  await queryClient.cancelQueries({
    queryKey: ['diary', 'notes', variables.flag, variables.noteId],
    exact: true,
  });

  queryClient.setQueryData(
    ['diary', 'notes', variables.flag, variables.noteId],
    updater
  );
}

async function updateNotesInCache(
  variables: { flag: DiaryFlag },
  updater: (notes: DiaryOutlines | undefined) => DiaryOutlines | undefined,
  queryClient: QueryClient
) {
  await queryClient.cancelQueries(['diary', 'notes', variables.flag]);

  queryClient.setQueryData(['diary', 'notes', variables.flag], updater);
}

function diaryAction(
  flag: DiaryFlag,
  action: DiaryAction
): Poke<DiaryShelfAction> {
  return {
    app: 'diary',
    mark: 'diary-action',
    json: {
      diary: {
        flag,
        action,
      },
    },
  };
}

function diaryNoteDiff(flag: DiaryFlag, id: string, command: NoteDelta) {
  return diaryAction(flag, {
    note: {
      id,
      command,
    },
  });
}

export interface DiaryState {
  pendingNotes: string[];
  [key: string]: unknown;
}

export const useDiaryState = create<DiaryState>(() => ({
  pendingNotes: [],
}));

export function usePendingNotes() {
  return useDiaryState((s) => s.pendingNotes);
}

export function useIsNotePending(noteId: string) {
  return useDiaryState((s) => s.pendingNotes.includes(noteId));
}

export function useNotes(flag: DiaryFlag) {
  const { data, ...rest } = useReactQuerySubscription({
    queryKey: ['diary', 'notes', flag],
    app: 'diary',
    path: `/diary/${flag}/ui`,
    scry: `/diary/${flag}/notes/newest/${INITIAL_MESSAGE_FETCH_PAGE_SIZE}/outline`,
    priority: 2,
  });

  let noteMap = restoreMap<DiaryOutline>(data);

  if (data === undefined || Object.entries(data as object).length === 0) {
    return {
      letters: noteMap as BigIntOrderedMap<DiaryOutline>,
      ...rest,
    };
  }

  const diff = Object.entries(data as object).map(([k, v]) => ({
    tim: bigInt(udToDec(k)),
    note: v as DiaryOutline,
  }));

  diff.forEach(({ tim, note }) => {
    noteMap = noteMap.set(tim, note);
  });

  return {
    letters: noteMap as BigIntOrderedMap<DiaryOutline>,
    ...rest,
  };
}

export function useNotesOnHost(
  flag: DiaryFlag,
  enabled: boolean
): DiaryOutlines | undefined {
  const { data } = useReactQueryScry({
    queryKey: ['diary', 'notes', 'live', flag],
    app: 'diary',
    path: `/diary/${flag}/notes/newest/${INITIAL_MESSAGE_FETCH_PAGE_SIZE}/outline`,
    priority: 2,
    options: {
      cacheTime: 0,
      enabled,
      refetchInterval: 1000,
    },
  });

  if (
    data === undefined ||
    data === null ||
    Object.entries(data as object).length === 0
  ) {
    return undefined;
  }

  return data as DiaryOutlines;
}

export function useOlderNotes(flag: DiaryFlag, count: number, enabled = false) {
  const queryClient = useQueryClient();
  const notes = useNotes(flag);

  let noteMap = restoreMap<DiaryOutline>(notes);

  const index = noteMap.peekSmallest()?.[0];
  const oldNotesSize = noteMap.size ?? 0;

  const fetchStart = index ? decToUd(index.toString()) : decToUd('0');

  const { data, ...rest } = useReactQueryScry({
    queryKey: ['diary', 'notes', flag, 'older', fetchStart],
    app: 'diary',
    path: `/diary/${flag}/notes/older/${fetchStart}/${count}/outline`,
    priority: 2,
    options: {
      enabled:
        enabled &&
        index !== undefined &&
        oldNotesSize !== 0 &&
        !!fetchStart &&
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
    note: v as DiaryOutline,
  }));

  diff.forEach(({ tim, note }) => {
    noteMap = noteMap.set(tim, note);
  });

  queryClient.setQueryData(['diary', 'notes', flag], noteMap.root);

  return rest.isLoading;
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

const defaultPerms = {
  writers: [],
};

export function useArrangedNotes(flag: DiaryFlag) {
  const diary = useDiary(flag);

  if (diary === undefined || diary['arranged-notes'] === undefined) {
    return [];
  }

  return diary['arranged-notes'].map((t) => udToDec(t));
}

export function useDiaryPerms(flag: DiaryFlag) {
  const diary = useDiary(flag);

  if (diary === undefined) {
    return defaultPerms;
  }

  return diary.perms as DiaryPerm;
}

export function useNote(flag: DiaryFlag, noteId: string, disabled = false) {
  const queryKey = useMemo(
    () => ['diary', 'notes', flag, noteId],
    [flag, noteId]
  );

  const path = useMemo(
    () => `/diary/${flag}/notes/note/${decToUd(noteId)}`,
    [flag, noteId]
  );
  const enabled = useMemo(
    () => noteId !== '0' && flag !== '' && !disabled,
    [noteId, flag, disabled]
  );
  const { data, ...rest } = useReactQueryScry({
    queryKey,
    app: 'diary',
    path,
    options: {
      enabled,
    },
  });

  const note = data as DiaryNoteInCache;

  const quips = note?.seal?.quips;

  let quipMap: BigIntOrderedMap<DiaryQuip> = restoreMap<DiaryQuip>(quips);

  if (quips === undefined) {
    return {
      note: {
        ...note,
        seal: {
          ...note?.seal,
          quips: quipMap,
        },
      },
      ...rest,
    };
  }

  const diff = Object.entries(quips).map(([k, v]) => ({
    tim: bigInt(udToDec(k)),
    quip: v as DiaryQuip,
  }));

  diff.forEach(({ tim, quip }) => {
    quipMap = quipMap.set(tim, quip);
  });

  const noteWithQuips = {
    ...note,
    seal: {
      ...note?.seal,
      quips: quipMap,
    },
  };

  return {
    note: noteWithQuips,
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

const emptyBriefs = {};
export function useDiaryBriefs(): DiaryBriefs {
  const { data, ...rest } = useReactQuerySubscription({
    queryKey: ['diary', 'briefs'],
    app: 'diary',
    path: '/briefs',
    scry: '/briefs',
  });

  if (rest.isLoading || rest.isError || data === undefined) {
    return emptyBriefs;
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

export function useDiarySortMode(flag: string): DiarySortMode {
  const diary = useDiary(flag);
  return diary?.sort ?? 'time';
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

  if (rest.isLoading || rest.isError || !data) {
    return {} as DiaryOutline;
  }

  const { outline } = data as DiarySaid;

  return outline as DiaryOutline;
}

export function useMarkReadDiaryMutation() {
  const mutationFn = async (variables: { flag: string }) => {
    await api.poke(diaryAction(variables.flag, { read: null }));
  };

  return useMutation({
    mutationFn,
  });
}

export function useJoinDiaryMutation() {
  const mutationFn = async ({
    group,
    chan,
  }: {
    group: string;
    chan: string;
  }) => {
    await api.trackedPoke<DiaryShelfAction, DiaryShelfResponse>(
      diaryAction(chan, {
        join: group,
      }),
      { app: 'diary', path: '/ui' },
      (event) => event.flag === chan && 'create' in event.response
    );
  };

  return useMutation(mutationFn);
}

export function useLeaveDiaryMutation() {
  const queryClient = useQueryClient();
  const mutationFn = async (variables: { flag: string }) => {
    await api.poke(diaryAction(variables.flag, { leave: null }));
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries(['diary', 'shelf']);
      await queryClient.cancelQueries(['diary', 'briefs']);
      await queryClient.cancelQueries(['diary', 'perms', variables.flag]);
      await queryClient.cancelQueries(['diary', 'notes', variables.flag]);
      queryClient.removeQueries(['diary', 'perms', variables.flag]);
      queryClient.removeQueries(['diary', 'notes', variables.flag]);
    },
    onSettled: async (_data, _error) => {
      await queryClient.refetchQueries(['diary', 'shelf']);
      await queryClient.refetchQueries(['diary', 'briefs']);
    },
  });
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

export function useSortDiaryMutation() {
  const queryClient = useQueryClient();
  const mutationFn = async (variables: {
    flag: string;
    sort: DiarySortMode;
  }) => {
    await api.poke(diaryAction(variables.flag, { sort: variables.sort }));
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
              sort: variables.sort,
            },
          }
        );
      }
    },
  });
}

export function useArrangedNotesDiaryMutation() {
  const queryClient = useQueryClient();
  const { mutate: changeSortMutation } = useSortDiaryMutation();

  const mutationFn = async (variables: {
    flag: string;
    arrangedNotes: string[];
  }) => {
    // change sort mode automatically if arrangedNotes is empty/not-empty
    if (variables.arrangedNotes.length === 0) {
      changeSortMutation({ flag: variables.flag, sort: 'time' });
    } else {
      changeSortMutation({ flag: variables.flag, sort: 'arranged' });
    }

    await api.poke(
      diaryAction(variables.flag, {
        order: variables.arrangedNotes.map((t) => decToUd(t)),
      })
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
              'arranged-notes': variables.arrangedNotes.map((t) => decToUd(t)),
            },
          }
        );
      }
    },
  });
}

export function useAddNoteMutation() {
  const queryClient = useQueryClient();

  let timePosted: string;
  const mutationFn = async (variables: {
    initialTime: string;
    flag: DiaryFlag;
    essay: NoteEssay;
  }) =>
    new Promise<string>((resolve) => {
      timePosted = variables.initialTime;
      api
        .trackedPoke<DiaryShelfAction, DiaryShelfResponse>(
          diaryNoteDiff(variables.flag, decToUd(variables.initialTime), {
            add: variables.essay,
          }),
          { app: 'diary', path: `/diary/${variables.flag}/ui` },
          ({ response }) => {
            if ('note' in response) {
              const { id, command } = response.note;
              if (
                'add' in command &&
                command.add.author === variables.essay.author &&
                command.add.sent === variables.essay.sent
              ) {
                timePosted = id;
                return true;
              }
              return false;
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

      useDiaryState.setState((state) => ({
        pendingNotes: [variables.initialTime, ...state.pendingNotes],
      }));

      const notes = queryClient.getQueryData<DiaryOutline>([
        'diary',
        'notes',
        variables.flag,
      ]);

      if (notes !== undefined) {
        // for the unlikely case that the user navigates away from the editor
        // before the mutation is complete, or if the host ship is offline,
        // we update the cache optimistically.
        queryClient.setQueryData<DiaryOutline>(
          ['diary', 'notes', variables.flag],
          {
            ...notes,
            // this time is temporary, and will be replaced by the actual time
            [variables.initialTime]: {
              content: variables.essay.content,
              author: variables.essay.author,
              quipCount: 0,
              quippers: [],
              title: variables.essay.title,
              image: variables.essay.image,
              sent: variables.essay.sent,
              type: 'outline',
            },
          }
        );

        queryClient.setQueryData(
          ['diary', 'notes', variables.flag, variables.initialTime],
          {
            type: 'note',
            seal: {
              time: variables.initialTime,
              quips: [],
              feels: {},
            },
            essay: {
              ...variables.essay,
            },
          }
        );
      }
    },
    onSuccess: async (_data, variables) => {
      useDiaryState.setState((state) => ({
        pendingNotes: state.pendingNotes.filter(
          (time) => time !== variables.initialTime
        ),
      }));
    },
    onSettled: async (_data, _error, variables) => {
      await queryClient.refetchQueries(['diary', 'notes', variables.flag], {
        exact: true,
      });
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
      const updater = (prev: DiaryNoteInCache | undefined) => {
        if (prev === undefined) {
          return prev;
        }

        return {
          ...prev,
          essay: variables.essay,
        };
      };

      const notesUpdater = (prev: DiaryOutlines | undefined) => {
        if (prev === undefined) {
          return prev;
        }

        return {
          ...prev,
          [variables.time]: {
            ...prev[decToUd(variables.time)],
            essay: variables.essay,
          },
        };
      };

      await updateNoteInCache(
        {
          flag: variables.flag,
          noteId: variables.time,
        },
        updater,
        queryClient
      );

      await updateNotesInCache(variables, notesUpdater, queryClient);
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
      const updater = (prev: DiaryOutlines | undefined) => {
        if (prev === undefined) {
          return prev;
        }

        const { [decToUd(variables.time)]: _, ...rest } = prev;

        return rest;
      };

      await updateNotesInCache(variables, updater, queryClient);

      await queryClient.cancelQueries([
        'diary',
        'notes',
        variables.flag,
        variables.time,
      ]);
    },
    onSettled: async (_data, _error, variables) => {
      await queryClient.refetchQueries(['diary', 'notes', variables.flag], {
        exact: true,
      });
    },
  });
}

export function useCreateDiaryMutation() {
  const queryClient = useQueryClient();

  const mutationFn = async (variables: DiaryCreate) => {
    await api.trackedPoke<DiaryShelfAction, DiaryShelfResponse>(
      {
        app: 'diary',
        mark: 'diary-action',
        json: {
          create: variables,
        },
      },
      { app: 'diary', path: '/ui' },
      (event) => {
        const { response, flag } = event;
        return (
          'create' in response && flag === `${window.our}/${variables.name}`
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
              'arranged-notes': [],
              sort: 'time',
              saga: { synced: null },
            },
          }
        );
      }
    },
    onSettled: async (_data, _error, variables) => {
      await queryClient.refetchQueries(['diary', 'shelf']);
      await queryClient.refetchQueries([
        'diary',
        'notes',
        variables.name,
        { exact: true },
      ]);
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
      diaryAction(variables.flag, { 'add-writers': variables.writers })
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
      diaryAction(variables.flag, { 'del-writers': variables.writers })
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
    const action: DiaryAction = {
      note: {
        id: replying,
        command: {
          quips: {
            id: decToUd(unixToDa(Date.now()).toString()),
            command: {
              add: memo,
            },
          },
        },
      },
    };

    await api.poke(diaryAction(variables.flag, action));
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      const notesUpdater = (prev: Record<string, DiaryOutline> | undefined) => {
        if (prev === undefined) {
          return prev;
        }

        const replying = decToUd(variables.noteId);
        if (replying in prev) {
          const replyingNote = prev[replying] as DiaryOutline;
          const updatedNote = {
            ...replyingNote,
            quipCount: replyingNote.quipCount + 1,
            quippers: [...replyingNote.quippers, window.our],
          };

          return {
            ...prev,
            [replying]: updatedNote,
          };
        }
        return prev;
      };

      const updater = (prevNote: DiaryNoteInCache | undefined) => {
        if (prevNote === undefined) {
          return prevNote;
        }
        const prevQuips = prevNote.seal.quips;
        const dateTime = Date.now();
        const newQuips = {
          ...prevQuips,
          [decToUd(unixToDa(dateTime).toString())]: {
            cork: {
              time: parseInt(unixToDa(dateTime).toString()),
              feels: {},
            },
            memo: {
              content: variables.content,
              author: window.our,
              sent: dateTime,
            },
          },
        };

        const updatedNote: DiaryNoteInCache = {
          ...prevNote,
          seal: {
            ...prevNote.seal,
            quips: newQuips,
          },
        };

        return updatedNote;
      };

      await updateNotesInCache(variables, notesUpdater, queryClient);
      await updateNoteInCache(variables, updater, queryClient);
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
    const action: DiaryAction = {
      note: {
        id: decToUd(variables.noteId),
        command: {
          quips: {
            id: decToUd(variables.quipId),
            command: {
              del: null,
            },
          },
        },
      },
    };

    await api.poke(diaryAction(variables.flag, action));
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      const notesUpdater = (prev: Record<string, DiaryOutline> | undefined) => {
        if (prev === undefined) {
          return prev;
        }
        const replying = decToUd(variables.noteId);
        if (replying in prev) {
          const replyingNote = prev[replying] as DiaryOutline;
          const updatedNote = {
            ...replyingNote,
            quipCount: replyingNote.quipCount - 1,
            quippers: replyingNote.quippers.filter(
              (quipper) => quipper !== window.our
            ),
          };

          return {
            ...prev,
            [replying]: updatedNote,
          };
        }
        return prev;
      };

      const updater = (prevNote: DiaryNoteInCache | undefined) => {
        if (prevNote === undefined) {
          return prevNote;
        }

        const prevQuips = prevNote.seal.quips;
        const newQuips = { ...prevQuips };
        delete newQuips[variables.quipId];

        const updatedNote: DiaryNoteInCache = {
          ...prevNote,
          seal: {
            ...prevNote.seal,
            quips: newQuips,
          },
        };

        return updatedNote;
      };

      await updateNoteInCache(variables, updater, queryClient);
      await updateNotesInCache(variables, notesUpdater, queryClient);
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
    const action: DiaryAction = {
      note: {
        id: decToUd(variables.noteId),
        command: {
          'add-feel': {
            feel: variables.feel,
            ship: window.our,
          },
        },
      },
    };

    await api.poke(diaryAction(variables.flag, action));
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      const updater = (prevNote: DiaryNoteInCache | undefined) => {
        if (prevNote === undefined) {
          return prevNote;
        }
        const prevFeels = prevNote.seal.feels;
        const newFeels = {
          ...prevFeels,
          [unixToDa(Date.now()).toString()]: variables.feel,
        };

        const updatedNote: DiaryNoteInCache = {
          ...prevNote,
          seal: {
            ...prevNote.seal,
            feels: newFeels,
          },
        };

        return updatedNote;
      };

      await updateNoteInCache(variables, updater, queryClient);
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
    const action: DiaryAction = {
      note: {
        id: decToUd(variables.noteId),
        command: {
          'del-feel': window.our,
        },
      },
    };

    await api.poke(diaryAction(variables.flag, action));
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      const updater = (prev: DiaryNoteInCache | undefined) => {
        if (prev === undefined) {
          return prev;
        }

        const prevFeels = prev.seal.feels;
        const newFeels = {
          ...prevFeels,
        };
        delete newFeels[window.our];

        const updatedNote = {
          ...prev,
          seal: {
            ...prev.seal,
            feels: newFeels,
          },
        };

        return updatedNote;
      };

      await updateNoteInCache(variables, updater, queryClient);
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
    const action: DiaryAction = {
      note: {
        id: decToUd(variables.noteId),
        command: {
          quips: {
            id: decToUd(variables.quipId),
            command: {
              'add-feel': {
                feel: variables.feel,
                ship: window.our,
              },
            },
          },
        },
      },
    };

    await api.poke(diaryAction(variables.flag, action));
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      const updater = (prev: DiaryNoteInCache | undefined) => {
        if (prev === undefined) {
          return prev;
        }

        const { quips } = prev.seal;
        Object.entries(quips).forEach(([time, quip]) => {
          if (time === decToUd(variables.quipId)) {
            quips[decToUd(variables.quipId)] = {
              ...quip,
              cork: {
                ...quip.cork,
                feels: {
                  ...quip.cork.feels,
                  [window.our]: variables.feel,
                },
              },
            };
          }
        });

        const updatedNote = {
          ...prev,
          seal: {
            ...prev.seal,
            quips,
          },
        };

        return updatedNote;
      };

      await updateNoteInCache(variables, updater, queryClient);
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
    const action: DiaryAction = {
      note: {
        id: decToUd(variables.noteId),
        command: {
          quips: {
            id: decToUd(variables.quipId),
            command: {
              'del-feel': window.our,
            },
          },
        },
      },
    };

    await api.poke(diaryAction(variables.flag, action));
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      const updater = (prev: DiaryNoteInCache | undefined) => {
        if (prev === undefined) {
          return prev;
        }
        const { quips } = prev.seal;
        Object.entries(quips).forEach(([time, quip]) => {
          if (time === decToUd(variables.quipId)) {
            const newFeels = {
              ...quip.cork.feels,
            };
            delete newFeels[window.our];

            quips[decToUd(variables.quipId)] = {
              ...quip,
              cork: {
                ...quip.cork,
                feels: newFeels,
              },
            };
          }
        });

        const updatedNote = {
          ...prev,
          seal: {
            ...prev.seal,
            quips,
          },
        };

        return updatedNote;
      };

      await updateNoteInCache(variables, updater, queryClient);
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
