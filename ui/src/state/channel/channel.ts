import bigInt from 'big-integer';
import _ from 'lodash';
import { BigIntOrderedMap, decToUd, udToDec, unixToDa } from '@urbit/api';
import { useEffect, useMemo, useRef } from 'react';
import {
  QueryClient,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { Flag } from '@/types/hark';
import {
  Shelf,
  NoteAction,
  Ship,
  Quips,
  Diary,
  Perm,
  Memo,
  Quip,
  Action,
  DisplayMode,
  SortMode,
  Said,
  Create,
  Briefs,
  NoteEssay,
  Story,
  Notes,
  ShelfResponse,
  ShelfAction,
  Note,
  Nest,
  NoteTuple,
  NoteMap,
} from '@/types/channel';
import api from '@/api';
import { checkNest, nestToFlag, restoreMap } from '@/logic/utils';
import useReactQuerySubscription from '@/logic/useReactQuerySubscription';
import useReactQueryScry from '@/logic/useReactQueryScry';
import useReactQuerySubscribeOnce from '@/logic/useReactQuerySubscribeOnce';
import { INITIAL_MESSAGE_FETCH_PAGE_SIZE } from '@/constants';
import { Poke } from '@urbit/http-api';
import create from 'zustand';

interface NoteSealInCache {
  id: string;
  quips: Quips;
  feels: {
    [ship: Ship]: string;
  };
  quipCount: number;
  quippers: Ship[];
}

interface NoteInCache {
  type: 'note';
  seal: NoteSealInCache;
  essay: NoteEssay;
}

async function updateNoteInCache(
  variables: { nest: Nest; noteId: string },
  updater: (note: NoteInCache | undefined) => NoteInCache | undefined,
  queryClient: QueryClient
) {
  const [han, flag] = nestToFlag(variables.nest);
  await queryClient.cancelQueries({
    queryKey: [han, 'notes', flag, variables.noteId],
    exact: true,
  });

  queryClient.setQueryData([han, 'notes', flag, variables.noteId], updater);
}

async function updateNotesInCache(
  variables: { nest: Nest },
  updater: (notes: Notes | undefined) => Notes | undefined,
  queryClient: QueryClient
) {
  const [han, flag] = nestToFlag(variables.nest);
  await queryClient.cancelQueries([han, 'notes', flag]);

  queryClient.setQueryData([han, 'notes', flag], updater);
}

export function channelAction(nest: Nest, action: Action): Poke<ShelfAction> {
  checkNest(nest);
  return {
    app: 'channels',
    mark: 'channel-action',
    json: {
      diary: {
        nest,
        action,
      },
    },
  };
}

export function channelNoteAction(nest: Nest, action: NoteAction) {
  checkNest(nest);

  return channelAction(nest, {
    note: action,
  });
}

export interface State {
  pendingNotes: string[];
  [key: string]: unknown;
}

export const usePendingState = create<State>(() => ({
  pendingNotes: [],
}));

export function usePendingNotes() {
  return usePendingState((s) => s.pendingNotes);
}

export function useIsNotePending(noteId: string) {
  return usePendingState((s) => s.pendingNotes.includes(noteId));
}

export function useNotes(nest: Nest) {
  const [han, flag] = nestToFlag(nest);
  const { data, ...rest } = useReactQuerySubscription({
    queryKey: [han, 'notes', flag],
    app: 'channels',
    path: `/${nest}/ui`,
    scry: `/${nest}/notes/newest/${INITIAL_MESSAGE_FETCH_PAGE_SIZE}/outline`,
    priority: 2,
  });

  let notesMap = restoreMap<Note>(data);

  if (data === undefined || Object.entries(data as object).length === 0) {
    return {
      notes: notesMap as BigIntOrderedMap<Note>,
      ...rest,
    };
  }

  const diff = Object.entries(data as object).map(([k, v]) => ({
    tim: bigInt(udToDec(k)),
    note: v as Note,
  }));

  diff.forEach(({ tim, note }) => {
    notesMap = notesMap.set(tim, note);
  });

  return {
    notes: notesMap as BigIntOrderedMap<Note>,
    ...rest,
  };
}

export function useNotesOnHost(
  nest: Nest,
  enabled: boolean
): Notes | undefined {
  const [han, flag] = nestToFlag(nest);
  const { data } = useReactQueryScry({
    queryKey: [han, 'notes', 'live', flag],
    app: 'channels',
    path: `/${nest}/notes/newest/${INITIAL_MESSAGE_FETCH_PAGE_SIZE}/outline`,
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

  return data as Notes;
}

export function useOlderNotes(nest: Nest, count: number, enabled = false) {
  checkNest(nest);
  const queryClient = useQueryClient();
  const { notes } = useNotes(nest);

  let noteMap = restoreMap<Note>(notes);

  const index = noteMap.peekSmallest()?.[0];
  const oldNotesSize = noteMap.size ?? 0;

  const fetchStart = index ? decToUd(index.toString()) : decToUd('0');

  const [han, flag] = nestToFlag(nest);

  const { data, ...rest } = useReactQueryScry({
    queryKey: [han, 'notes', flag, 'older', fetchStart],
    app: 'channels',
    path: `/${nest}/notes/older/${fetchStart}/${count}/outline`,
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
    note: v as Note,
  }));

  diff.forEach(({ tim, note }) => {
    noteMap = noteMap.set(tim, note);
  });

  queryClient.setQueryData([han, 'notes', flag], noteMap.root);

  return rest.isLoading;
}

function generateNoteMap(curios: NoteTuple[]): NoteMap {
  let curioMap = restoreMap<Note>({});
  curios
    .map(([k, curio]) => ({ tim: bigInt(udToDec(k)), curio }))
    .forEach(({ tim, curio }) => {
      curioMap = curioMap.set(tim, curio);
    });

  return curioMap;
}

function formatNoteResponse(notes: Notes): NoteTuple[] {
  return Object.entries(notes).sort((a, b) => {
    const aTime = bigInt(udToDec(a[0]));
    const bTime = bigInt(udToDec(b[0]));
    return bTime.compare(aTime);
  });
}

export function useInfiniteNotes(nest: Nest) {
  const queryClient = useQueryClient();
  const def = useMemo(() => new BigIntOrderedMap<Note>(), []);
  const [han, flag] = nestToFlag(nest);
  const queryKey = useMemo(() => [han, 'notes', flag, 'infinite'], [han, flag]);

  const invalidate = useRef(
    _.debounce(
      () => {
        queryClient.invalidateQueries(queryKey);
      },
      300,
      {
        leading: true,
        trailing: true,
      }
    )
  );

  useEffect(() => {
    api.subscribe({
      app: 'channels',
      path: `/${nest}/ui`,
      event: invalidate.current,
    });
  }, [nest, invalidate]);

  const { data, fetchNextPage, hasNextPage, isLoading } = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }) => {
      const path = pageParam
        ? `/${nest}/notes/older/${pageParam}/${INITIAL_MESSAGE_FETCH_PAGE_SIZE}/outline`
        : `/${nest}/notes/newest/${INITIAL_MESSAGE_FETCH_PAGE_SIZE}/outline`;
      const response = await api.scry<Notes>({
        app: 'channels',
        path,
      });
      return formatNoteResponse(response);
    },
    getNextPageParam: (lastPage) =>
      lastPage.length ? _.last(lastPage)![0] : undefined,
    keepPreviousData: true,
    refetchOnMount: true,
    retryOnMount: true,
  });

  const notes = useMemo(
    () => generateNoteMap(data?.pages.flat() || []),
    [data]
  );

  return {
    notes: data ? notes : def,
    fetchNextPage,
    hasNextPage,
    isLoading,
  };
}

function removeNoteFromInfiniteQuery(
  queryClient: QueryClient,
  nest: string,
  time: string
) {
  const [han, flag] = nestToFlag(nest);
  const queryKey = [han, 'notes', flag, 'infinite'];
  const deletedId = decToUd(time);
  const currentData = queryClient.getQueryData(queryKey) as any;
  const newPages =
    currentData?.pages.map((page: any) =>
      page.filter(([id]: any) => id !== deletedId)
    ) ?? [];
  queryClient.setQueryData(queryKey, (data: any) => ({
    pages: newPages,
    pageParams: data.pageParams,
  }));
}

export async function prefetchNoteWithComments({
  queryClient,
  nest,
  time,
}: {
  queryClient: QueryClient;
  nest: Nest;
  time: string;
}) {
  const ud = decToUd(time);
  const [han] = nestToFlag(nest);
  const data = (await api.scry({
    app: 'channels',
    path: `/${nest}/notes/note/${ud}`,
  })) as Note;
  if (data) {
    queryClient.setQueryData([han, nest, 'notes', time, 'withComments'], data);
  }
}

export function useOrderedNotes(
  nest: Nest,
  currentId: bigInt.BigInteger | string
) {
  checkNest(nest);

  const queryClient = useQueryClient();
  const { notes } = useInfiniteNotes(nest);

  const sortedOutlines = Array.from(notes);

  sortedOutlines.sort(([a], [b]) => b.compare(a));

  const noteId = typeof currentId === 'string' ? bigInt(currentId) : currentId;
  const hasNext = notes.size > 0 && noteId.lt(notes.peekLargest()[0]);
  const hasPrev = notes.size > 0 && noteId.gt(notes.peekSmallest()[0]);
  const currentIdx = sortedOutlines.findIndex(([i, _c]) => i.eq(noteId));

  const nextNote = hasNext ? sortedOutlines[currentIdx - 1] : null;
  if (nextNote) {
    prefetchNoteWithComments({
      queryClient,
      nest,
      time: udToDec(nextNote[0].toString()),
    });
  }
  const prevNote = hasPrev ? sortedOutlines[currentIdx + 1] : null;
  if (prevNote) {
    prefetchNoteWithComments({
      queryClient,
      nest,
      time: udToDec(prevNote[0].toString()),
    });
  }

  return {
    hasNext,
    hasPrev,
    nextNote,
    prevNote,
    sortedOutlines,
  };
}

const emptyShelf: Shelf = {};
export function useShelf(): Shelf {
  const { data, ...rest } = useReactQuerySubscription<Shelf>({
    queryKey: ['shelf'],
    app: 'channels',
    path: '/ui',
    scry: '/shelf',
  });

  if (rest.isLoading || rest.isError || data === undefined) {
    return emptyShelf;
  }

  return data;
}

export function useChannel(nest: Nest): Diary | undefined {
  checkNest(nest);
  const shelf = useShelf();

  return shelf[nest];
}

const defaultPerms = {
  writers: [],
};

export function useArrangedNotes(nest: Nest): string[] {
  checkNest(nest);
  const diary = useChannel(nest);

  if (diary === undefined || diary.order === undefined) {
    return [];
  }

  return diary.order;
}

export function usePerms(nest: Nest): Perm {
  const diary = useChannel(nest);

  const [_han, flag] = nestToFlag(nest);

  if (diary === undefined) {
    return {
      group: flag,
      ...defaultPerms,
    };
  }

  return diary.perms as Perm;
}

export function useNote(nest: Nest, noteId: string, disabled = false) {
  const [han, flag] = nestToFlag(nest);

  const queryKey = useMemo(
    () => [han, 'notes', flag, noteId],
    [han, flag, noteId]
  );

  const path = useMemo(
    () => `/${nest}/notes/note/${decToUd(noteId)}`,
    [nest, noteId]
  );
  const enabled = useMemo(
    () => noteId !== '0' && nest !== '' && !disabled,
    [noteId, nest, disabled]
  );
  const { data, ...rest } = useReactQueryScry({
    queryKey,
    app: 'channels',
    path,
    options: {
      enabled,
    },
  });

  const note = data as NoteInCache;

  const quips = note?.seal?.quips;

  let quipMap: BigIntOrderedMap<Quip> = restoreMap<Quip>(quips);

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
    quip: v as Quip,
  }));

  diff.forEach(({ tim, quip }) => {
    quipMap = quipMap.set(tim, quip);
  });

  const noteWithQuips: Note = {
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
  nest: Nest,
  noteId: string,
  quipId: string,
  isScrolling = false
) {
  checkNest(nest);

  const { note } = useNote(nest, noteId, isScrolling);
  return useMemo(() => {
    if (note === undefined) {
      return undefined;
    }
    if (note.seal.quips === null || note.seal.quips.size === undefined) {
      return undefined;
    }
    const quip = note.seal.quips.get(bigInt(quipId));
    return quip;
  }, [note, quipId]);
}

const emptyBriefs: Briefs = {};
export function useBriefs(): Briefs {
  const { data, ...rest } = useReactQuerySubscription<Briefs>({
    queryKey: ['briefs'],
    app: 'channels',
    path: '/briefs',
    scry: '/briefs',
  });

  if (rest.isLoading || rest.isError || data === undefined) {
    return emptyBriefs;
  }

  return data;
}

export function useIsJoined(nest: Nest) {
  checkNest(nest);
  const briefs = useBriefs();

  return Object.keys(briefs).includes(nest);
}

export function useBrief(nest: Nest) {
  checkNest(nest);

  const briefs = useBriefs();

  return briefs[nest];
}

// TODO: this is a WIP part of implementing sorting by most recent comment
// export function useQuips(flag: string): [bigInt.BigInteger, QuipMap][] {
//   const def = useMemo(() => new BigIntOrderedMap<QuipMap>(), []);
//   const notes = useNotesFor(flag);
//   const getQuip = useQuips;
//   const quipNotes = Array.from(notes).map(([time, note]) => [time, getQuip(flag, time.toString())]);
// }

export function useDisplayMode(nest: string): DisplayMode {
  checkNest(nest);
  const diary = useChannel(nest);
  return diary?.view ?? 'list';
}

export function useSortMode(nest: string): SortMode {
  checkNest(nest);
  const diary = useChannel(nest);
  return diary?.sort ?? 'time';
}

export function useRemoteNote(nest: Nest, time: string, blockLoad: boolean) {
  checkNest(nest);
  const [han, flag] = nestToFlag(nest);
  const path = `/said/${nest}/note/${decToUd(time)}`;
  const { data, ...rest } = useReactQuerySubscribeOnce({
    queryKey: [han, 'said', nest, time],
    app: 'channels',
    path,
    options: {
      enabled: !blockLoad,
    },
  });

  if (rest.isLoading || rest.isError || !data) {
    return {} as Note;
  }

  const { note } = data as Said;

  return note as Note;
}

export function useMarkReadMutation() {
  const queryClient = useQueryClient();
  const mutationFn = async (variables: { nest: Nest }) => {
    checkNest(variables.nest);

    await api.poke(channelAction(variables.nest, { read: null }));
  };

  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries(['briefs']);
    },
  });
}

export function useJoinMutation() {
  const mutationFn = async ({ group, chan }: { group: Flag; chan: Nest }) => {
    if (chan.split('/').length !== 3) {
      throw new Error('Invalid nest');
    }

    await api.trackedPoke<ShelfAction, ShelfResponse>(
      channelAction(chan, {
        join: group,
      }),
      { app: 'channels', path: '/ui' },
      (event) => event.nest === chan && 'create' in event.response
    );
  };

  return useMutation(mutationFn);
}

export function useLeaveMutation() {
  const queryClient = useQueryClient();
  const mutationFn = async (variables: { nest: Nest }) => {
    checkNest(variables.nest);
    await api.poke(channelAction(variables.nest, { leave: null }));
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      const [han, flag] = nestToFlag(variables.nest);
      await queryClient.cancelQueries(['shelf']);
      await queryClient.cancelQueries(['briefs']);
      await queryClient.cancelQueries([han, 'perms', flag]);
      await queryClient.cancelQueries([han, 'notes', flag]);
      queryClient.removeQueries([han, 'perms', flag]);
      queryClient.removeQueries([han, 'notes', flag]);
    },
    onSettled: async (_data, _error) => {
      await queryClient.invalidateQueries(['shelf']);
      await queryClient.invalidateQueries(['briefs']);
    },
  });
}

export function useViewMutation() {
  const queryClient = useQueryClient();
  const mutationFn = async (variables: { nest: Nest; view: DisplayMode }) => {
    checkNest(variables.nest);
    await api.poke(channelAction(variables.nest, { view: variables.view }));
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries(['shelf']);

      const prev = queryClient.getQueryData<{ [nest: Nest]: Diary }>(['shelf']);

      if (prev !== undefined) {
        queryClient.setQueryData<{ [nest: Nest]: Diary }>(['shelf'], {
          ...prev,
          [variables.nest]: {
            ...prev[variables.nest],
            view: variables.view,
          },
        });
      }
    },
  });
}

export function useSortMutation() {
  const queryClient = useQueryClient();
  const mutationFn = async (variables: { nest: Nest; sort: SortMode }) => {
    await api.poke(channelAction(variables.nest, { sort: variables.sort }));
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      checkNest(variables.nest);

      await queryClient.cancelQueries(['shelf']);

      const prev = queryClient.getQueryData<{ [nest: Nest]: Diary }>(['shelf']);

      if (prev !== undefined) {
        queryClient.setQueryData<{ [nest: Nest]: Diary }>(['shelf'], {
          ...prev,
          [variables.nest]: {
            ...prev[variables.nest],
            sort: variables.sort,
          },
        });
      }
    },
  });
}

export function useArrangedNotesMutation() {
  const queryClient = useQueryClient();
  const { mutate: changeSortMutation } = useSortMutation();

  const mutationFn = async (variables: {
    nest: Nest;
    arrangedNotes: string[];
  }) => {
    checkNest(variables.nest);

    // change sort mode automatically if arrangedNotes is empty/not-empty
    if (variables.arrangedNotes.length === 0) {
      changeSortMutation({ nest: variables.nest, sort: 'time' });
    } else {
      changeSortMutation({ nest: variables.nest, sort: 'arranged' });
    }

    await api.poke(
      channelAction(variables.nest, {
        order: variables.arrangedNotes.map((t) => decToUd(t)),
      })
    );
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries(['shelf']);

      const prev = queryClient.getQueryData<{ [nest: Nest]: Diary }>(['shelf']);

      if (prev !== undefined) {
        queryClient.setQueryData<{ [nest: Nest]: Diary }>(['shelf'], {
          ...prev,
          [variables.nest]: {
            ...prev[variables.nest],
            order: variables.arrangedNotes.map((t) => decToUd(t)),
          },
        });
      }
    },
  });
}

export function useAddNoteMutation() {
  const queryClient = useQueryClient();

  let timePosted: string;
  const mutationFn = async (variables: {
    initialTime: string;
    nest: Nest;
    essay: NoteEssay;
  }) => {
    checkNest(variables.nest);

    return new Promise<string>((resolve) => {
      timePosted = variables.initialTime;
      try {
        api
          .trackedPoke<ShelfAction, ShelfResponse>(
            channelNoteAction(variables.nest, {
              add: variables.essay,
            }),
            { app: 'channels', path: `/${variables.nest}/ui` },
            ({ response }) => {
              if ('note' in response) {
                const { id, 'r-note': noteResponse } = response.note;
                if (
                  'set' in noteResponse &&
                  noteResponse.set !== null &&
                  noteResponse.set.essay.author === variables.essay.author &&
                  noteResponse.set.essay.sent === variables.essay.sent
                ) {
                  timePosted = id;
                  return true;
                }
                return true;
              }

              return false;
            }
          )
          .then(() => {
            resolve(timePosted);
          });
      } catch (e) {
        console.error(e);
      }
    });
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      const [han, flag] = nestToFlag(variables.nest);

      await queryClient.cancelQueries([han, 'notes', flag]);
      await queryClient.cancelQueries(['briefs']);

      usePendingState.setState((state) => ({
        pendingNotes: [variables.initialTime, ...state.pendingNotes],
      }));

      const notes = queryClient.getQueryData<Notes>([han, 'notes', flag]);

      if (notes !== undefined) {
        // for the unlikely case that the user navigates away from the editor
        // before the mutation is complete, or if the host ship is offline,
        // we update the cache optimistically.
        queryClient.setQueryData<Notes>([han, 'notes', flag], {
          ...notes,
          // this time is temporary, and will be replaced by the actual time
          [variables.initialTime]: {
            seal: {
              id: variables.initialTime,
              quips: null,
              feels: {},
              quipCount: 0,
              quippers: [],
            },
            essay: {
              ...variables.essay,
            },
          },
        });

        queryClient.setQueryData([han, 'notes', flag, variables.initialTime], {
          type: 'note',
          seal: {
            time: decToUd(variables.initialTime),
            quips: [],
            feels: {},
          },
          essay: {
            ...variables.essay,
          },
        });
      }
    },
    onSuccess: async (_data, variables) => {
      usePendingState.setState((state) => ({
        pendingNotes: state.pendingNotes.filter(
          (time) => time !== variables.initialTime
        ),
      }));
      const [han, flag] = nestToFlag(variables.nest);
      queryClient.removeQueries([han, 'notes', flag, variables.initialTime]);
    },
    onSettled: async (_data, _error, variables) => {
      const [han, flag] = nestToFlag(variables.nest);
      await queryClient.refetchQueries([han, 'notes', flag], { exact: true });
      await queryClient.refetchQueries(['briefs']);
    },
  });
}

export function useEditNoteMutation() {
  const queryClient = useQueryClient();
  const mutationFn = async (variables: {
    nest: Nest;
    time: string;
    essay: NoteEssay;
  }) => {
    checkNest(variables.nest);

    await api.poke(
      channelNoteAction(variables.nest, {
        edit: {
          id: decToUd(variables.time),
          essay: variables.essay,
        },
      })
    );
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      const updater = (prev: NoteInCache | undefined) => {
        if (prev === undefined) {
          return prev;
        }

        return {
          ...prev,
          essay: variables.essay,
        };
      };

      const notesUpdater = (prev: Notes | undefined) => {
        if (prev === undefined) {
          return prev;
        }

        const prevNote = prev[decToUd(variables.time)];

        if (prevNote === null) {
          return prev;
        }

        return {
          ...prev,
          [variables.time]: {
            seal: prevNote.seal,
            essay: variables.essay,
          },
        };
      };

      await updateNoteInCache(
        {
          nest: variables.nest,
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
  const mutationFn = async (variables: { nest: Nest; time: string }) => {
    checkNest(variables.nest);

    await api.trackedPoke<ShelfAction, ShelfResponse>(
      channelNoteAction(variables.nest, { del: variables.time }),
      {
        app: 'channels',
        path: `/${variables.nest}/ui`,
      },
      (event) => {
        if ('note' in event.response) {
          const { id, 'r-note': noteResponse } = event.response.note;
          return (
            id === variables.time &&
            'set' in noteResponse &&
            noteResponse.set === null
          );
        }
        return false;
      }
    );
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      const [han, flag] = nestToFlag(variables.nest);

      const updater = (prev: Notes | undefined) => {
        if (prev === undefined) {
          return prev;
        }

        const { [decToUd(variables.time)]: _n, ...rest } = prev;

        return rest;
      };

      await updateNotesInCache(variables, updater, queryClient);

      await queryClient.cancelQueries([han, 'notes', flag, variables.time]);
    },
    onSuccess: async (_data, variables) => {
      removeNoteFromInfiniteQuery(queryClient, variables.nest, variables.time);
    },
    onSettled: async (_data, _error, variables) => {
      const [han, flag] = nestToFlag(variables.nest);
      await queryClient.invalidateQueries([han, 'notes', flag]);
      await queryClient.invalidateQueries([han, 'notes', flag, 'infinite']);
    },
  });
}

export function useCreateMutation() {
  const queryClient = useQueryClient();

  const mutationFn = async (variables: Create) => {
    await api.trackedPoke<ShelfAction, ShelfResponse>(
      {
        app: 'channels',
        mark: 'channel-action',
        json: {
          create: variables,
        },
      },
      { app: 'channels', path: '/ui' },
      (event) => {
        const { response, nest } = event;
        return (
          'create' in response &&
          nest === `${variables.han}/${window.our}/${variables.name}`
        );
      }
    );
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries(['shelf']);

      const prev = queryClient.getQueryData<{ [nest: Nest]: Diary }>(['shelf']);

      if (prev !== undefined) {
        queryClient.setQueryData<{ [nest: Nest]: Diary }>(['shelf'], {
          ...prev,
          [`${variables.han}/${window.our}/${variables.name}`]: {
            perms: { writers: [], group: variables.group },
            view: 'list',
            order: [],
            sort: 'time',
            saga: { synced: null },
          },
        });
      }
    },
    onSettled: async (_data, _error, variables) => {
      await queryClient.invalidateQueries(['shelf']);
      await queryClient.invalidateQueries([
        variables.han,
        'notes',
        `${window.our}/${variables.name}`,
        { exact: true },
      ]);
    },
  });
}

export function useAddSectsMutation() {
  const queryClient = useQueryClient();
  const mutationFn = async (variables: { nest: Nest; writers: string[] }) => {
    await api.poke(
      channelAction(variables.nest, { 'add-writers': variables.writers })
    );
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      checkNest(variables.nest);

      await queryClient.cancelQueries(['shelf']);

      const prev = queryClient.getQueryData<{ [nest: Nest]: Diary }>(['shelf']);

      if (prev !== undefined) {
        queryClient.setQueryData<{ [nest: Nest]: Diary }>(['shelf'], {
          ...prev,
          [variables.nest]: {
            ...prev[variables.nest],
            perms: {
              ...prev[variables.nest].perms,
              writers: [
                ...prev[variables.nest].perms.writers,
                ...variables.writers,
              ],
            },
          },
        });
      }
    },
  });
}

export function useDeleteSectsMutation() {
  const queryClient = useQueryClient();
  const mutationFn = async (variables: { nest: Nest; writers: string[] }) => {
    checkNest(variables.nest);

    await api.poke(
      channelAction(variables.nest, { 'del-writers': variables.writers })
    );
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries(['shelf']);

      const prev = queryClient.getQueryData<{ [nest: Nest]: Diary }>(['shelf']);

      if (prev !== undefined) {
        queryClient.setQueryData<{ [nest: Nest]: Diary }>(['shelf'], {
          ...prev,
          [variables.nest]: {
            ...prev[variables.nest],
            perms: {
              ...prev[variables.nest].perms,
              writers: prev[variables.nest].perms.writers.filter(
                (writer) => !variables.writers.includes(writer)
              ),
            },
          },
        });
      }
    },
  });
}

export function useAddQuipMutation() {
  const queryClient = useQueryClient();
  const mutationFn = async (variables: {
    nest: Nest;
    noteId: string;
    content: Story;
  }) => {
    checkNest(variables.nest);

    const replying = decToUd(variables.noteId);
    const memo: Memo = {
      content: variables.content,
      author: window.our,
      sent: Date.now(),
    };
    const action: Action = {
      note: {
        quip: {
          id: replying,
          action: {
            add: memo,
          },
        },
      },
    };

    await api.poke(channelAction(variables.nest, action));
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      const notesUpdater = (prev: Record<string, Note> | undefined) => {
        if (prev === undefined) {
          return prev;
        }

        const replying = decToUd(variables.noteId);
        if (replying in prev) {
          const replyingNote = prev[replying] as Note;
          if (replyingNote === null) {
            return prev;
          }

          const updatedNote = {
            ...replyingNote,
            seal: {
              ...replyingNote.seal,
              quipCount: replyingNote.seal.quipCount + 1,
              quippers: [...replyingNote.seal.quippers, window.our],
            },
          };

          return {
            ...prev,
            [replying]: updatedNote,
          };
        }
        return prev;
      };

      const updater = (prevNote: NoteInCache | undefined) => {
        if (prevNote === undefined) {
          return prevNote;
        }
        const prevQuips = prevNote.seal.quips;
        const dateTime = Date.now();
        const newQuips: Record<string, Quip> = {
          ...prevQuips,
          [decToUd(unixToDa(dateTime).toString())]: {
            cork: {
              id: unixToDa(dateTime).toString(),
              feels: {},
            },
            memo: {
              content: variables.content,
              author: window.our,
              sent: dateTime,
            },
          },
        };

        const updatedNote: NoteInCache = {
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
    onSettled: async (_data, _error, variables) => {
      const [han, flag] = nestToFlag(variables.nest);
      await queryClient.refetchQueries([han, 'notes', flag]);
      await queryClient.refetchQueries([han, 'notes', flag, variables.noteId]);
    },
  });
}

export function useDeleteQuipMutation() {
  const queryClient = useQueryClient();
  const mutationFn = async (variables: {
    nest: Nest;
    noteId: string;
    quipId: string;
  }) => {
    checkNest(variables.nest);

    const action: Action = {
      note: {
        quip: {
          id: decToUd(variables.noteId),
          action: {
            del: decToUd(variables.quipId),
          },
        },
      },
    };

    await api.poke(channelAction(variables.nest, action));
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      const notesUpdater = (prev: Record<string, Note> | undefined) => {
        if (prev === undefined) {
          return prev;
        }
        const replying = decToUd(variables.noteId);
        if (replying in prev) {
          const replyingNote = prev[replying] as Note;

          if (replyingNote === null) {
            return prev;
          }

          const updatedNote = {
            ...replyingNote,
            seal: {
              ...replyingNote.seal,
              quipCount: replyingNote.seal.quipCount - 1,
              quippers: replyingNote.seal.quippers.filter(
                (quipper) => quipper !== window.our
              ),
            },
          };

          return {
            ...prev,
            [replying]: updatedNote,
          };
        }
        return prev;
      };

      const updater = (prevNote: NoteInCache | undefined) => {
        if (prevNote === undefined) {
          return prevNote;
        }

        const prevQuips = prevNote.seal.quips;
        const newQuips = { ...prevQuips };
        delete newQuips[variables.quipId];

        const updatedNote: NoteInCache = {
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
    onSettled: async (_data, _error, variables) => {
      const [han, flag] = nestToFlag(variables.nest);
      await queryClient.refetchQueries([han, 'notes', flag]);
      await queryClient.refetchQueries([han, 'notes', flag, variables.noteId]);
    },
  });
}

export function useAddNoteFeelMutation() {
  const queryClient = useQueryClient();
  const mutationFn = async (variables: {
    nest: Nest;
    noteId: string;
    feel: string;
  }) => {
    checkNest(variables.nest);

    const action: Action = {
      note: {
        'add-feel': {
          id: decToUd(variables.noteId),
          feel: variables.feel,
          ship: window.our,
        },
      },
    };

    await api.poke(channelAction(variables.nest, action));
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      const updater = (prevNote: NoteInCache | undefined) => {
        if (prevNote === undefined) {
          return prevNote;
        }
        const prevFeels = prevNote.seal.feels;
        const newFeels = {
          ...prevFeels,
          [unixToDa(Date.now()).toString()]: variables.feel,
        };

        const updatedNote: NoteInCache = {
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
      const [han, flag] = nestToFlag(variables.nest);
      await queryClient.invalidateQueries([han, 'notes', flag]);
      await queryClient.invalidateQueries([
        han,
        'notes',
        flag,
        variables.noteId,
      ]);
    },
  });
}

export function useDeleteNoteFeelMutation() {
  const queryClient = useQueryClient();
  const mutationFn = async (variables: { nest: Nest; noteId: string }) => {
    checkNest(variables.nest);

    const action: Action = {
      note: {
        'del-feel': {
          id: decToUd(variables.noteId),
          ship: window.our,
        },
      },
    };

    await api.poke(channelAction(variables.nest, action));
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      const updater = (prev: NoteInCache | undefined) => {
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
      const [han, flag] = nestToFlag(variables.nest);
      await queryClient.invalidateQueries([han, 'notes', flag]);
      await queryClient.invalidateQueries([
        han,
        'notes',
        flag,
        variables.noteId,
      ]);
    },
  });
}

export function useAddQuipFeelMutation() {
  const queryClient = useQueryClient();
  const mutationFn = async (variables: {
    nest: Nest;
    noteId: string;
    quipId: string;
    feel: string;
  }) => {
    checkNest(variables.nest);

    const action: Action = {
      note: {
        quip: {
          id: decToUd(variables.noteId),
          action: {
            'add-feel': {
              id: decToUd(variables.quipId),
              feel: variables.feel,
              ship: window.our,
            },
          },
        },
      },
    };

    await api.poke(channelAction(variables.nest, action));
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      const updater = (prev: NoteInCache | undefined) => {
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
    nest: Nest;
    noteId: string;
    quipId: string;
  }) => {
    checkNest(variables.nest);

    const action: Action = {
      note: {
        quip: {
          id: decToUd(variables.noteId),
          action: {
            'del-feel': {
              id: decToUd(variables.quipId),
              ship: window.our,
            },
          },
        },
      },
    };

    await api.poke(channelAction(variables.nest, action));
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      const updater = (prev: NoteInCache | undefined) => {
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
      const [han, flag] = nestToFlag(variables.nest);
      await queryClient.invalidateQueries([
        han,
        'notes',
        flag,
        variables.noteId,
      ]);
    },
  });
}
