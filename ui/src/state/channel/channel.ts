import bigInt, { BigInteger } from 'big-integer';
import _ from 'lodash';
import { decToUd, udToDec, unixToDa } from '@urbit/api';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Poke } from '@urbit/http-api';
import create from 'zustand';
import { QueryKey, useInfiniteQuery, useMutation } from '@tanstack/react-query';
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
  NoteMap,
  newNoteMap,
  newQuipMap,
  QuipMap,
  NoteTuple,
  BriefUpdate,
  PagedNotes,
  PagedNotesMap,
} from '@/types/channel';
import {
  extendCurrentWindow,
  getWindow,
  Window,
  WindowSet,
} from '@/logic/windows';
import api from '@/api';
import { checkNest, log, nestToFlag, restoreMap } from '@/logic/utils';
import useReactQuerySubscription from '@/logic/useReactQuerySubscription';
import useReactQueryScry from '@/logic/useReactQueryScry';
import useReactQuerySubscribeOnce from '@/logic/useReactQuerySubscribeOnce';
import { INITIAL_MESSAGE_FETCH_PAGE_SIZE } from '@/constants';
import queryClient from '@/queryClient';

interface NoteSealInCache {
  id: string;
  quips: Quips;
  feels: {
    [ship: Ship]: string;
  };
  meta: {
    quipCount: number;
    lastQuippers: Ship[];
    lastQuip: number | null;
  };
}

interface NoteInCache {
  seal: NoteSealInCache;
  essay: NoteEssay;
}

async function updateNoteInCache(
  variables: { nest: Nest; noteId: string },
  updater: (note: NoteInCache | undefined) => NoteInCache | undefined
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
  updater: (notes: Notes | undefined) => Notes | undefined
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

export interface NoteWindows {
  [nest: string]: WindowSet;
}

export type NoteStatus = 'pending' | 'sent' | 'delivered';

export interface TrackedNote {
  cacheId: CacheId;
  status: NoteStatus;
}

export interface CacheId {
  author: string;
  sent: number;
}

export interface State {
  trackedNotes: TrackedNote[];
  noteWindows: NoteWindows;
  addTracked: (id: CacheId) => void;
  updateStatus: (id: CacheId, status: NoteStatus) => void;
  getCurrentWindow: (nest: string, time?: string) => Window | undefined;
  extendCurrentWindow: (nest: Nest, newWindow: Window, time?: string) => void;
  [key: string]: unknown;
}

export const useNotesStore = create<State>((set, get) => ({
  trackedNotes: [],
  noteWindows: {},
  addTracked: (id) => {
    set((state) => ({
      trackedNotes: [{ status: 'pending', cacheId: id }, ...state.trackedNotes],
    }));
  },
  updateStatus: (id, s) => {
    log('setting status', s);
    set((state) => ({
      trackedNotes: state.trackedNotes.map(({ cacheId, status }) => {
        if (_.isEqual(cacheId, id)) {
          return { status: s, cacheId };
        }

        return { status, cacheId };
      }),
    }));
  },
  getCurrentWindow: (nest, time) => {
    const currentSet = get().noteWindows[nest];
    return getWindow(currentSet, time);
  },
  extendCurrentWindow: (nest, newWindow, time) => {
    set((state) => {
      const currentSet = state.noteWindows[nest];

      return {
        noteWindows: {
          ...state.noteWindows,
          [nest]: extendCurrentWindow(newWindow, currentSet, time),
        },
      };
    });
  },
}));

export function useCurrentWindow(nest: Nest, time?: string) {
  const getCurrentWindow = useCallback(
    () => useNotesStore.getState().getCurrentWindow(nest, time),
    [time, nest]
  );

  return getCurrentWindow();
}

export function useTrackedNotes() {
  return useNotesStore((s) => s.trackedNotes);
}

export function useIsNotePending(cacheId: CacheId) {
  return useNotesStore((s) =>
    s.trackedNotes.some(
      ({ status: noteStatus, cacheId: nId }) =>
        noteStatus === 'pending' &&
        nId.author === cacheId.author &&
        nId.sent === cacheId.sent
    )
  );
}

export function useTrackedNoteStatus(cacheId: CacheId) {
  return useNotesStore(
    (s) =>
      s.trackedNotes.find(
        ({ cacheId: nId }) =>
          nId.author === cacheId.author && nId.sent === cacheId.sent
      )?.status || 'delivered'
  );
}

export function useNotes(nest: Nest) {
  const [han, flag] = nestToFlag(nest);
  const { data, ...rest } = useReactQuerySubscription<Notes>({
    queryKey: [han, 'notes', flag],
    app: 'channels',
    path: `/${nest}/ui`,
    scry: `/${nest}/notes/newest/${INITIAL_MESSAGE_FETCH_PAGE_SIZE}/outline`,
    priority: 2,
  });

  if (data === undefined || Object.entries(data).length === 0) {
    return {
      notes: newNoteMap(),
      ...rest,
    };
  }

  const diff: [BigInteger, Note][] = Object.entries(data).map(([k, v]) => [
    bigInt(udToDec(k)),
    v as Note,
  ]);

  const notesMap = newNoteMap(diff);

  return {
    notes: notesMap as NoteMap,
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

const infiniteNoteUpdater = (
  queryKey: QueryKey,
  data: ShelfResponse,
  initialTime?: string
) => {
  const { nest, response } = data;

  if (!('note' in response)) {
    return;
  }

  const noteResponse = response.note['r-note'];
  const { id } = response.note;
  const time = bigInt(udToDec(id));

  if ('set' in noteResponse) {
    const note = noteResponse.set;

    if (note === null) {
      queryClient.setQueryData(
        queryKey,
        (
          d: { pages: PagedNotesMap[]; pageParams: PageParam[] } | undefined
        ) => {
          if (d === undefined) {
            return undefined;
          }

          const newPages = d.pages.map((page) => {
            const inPage = page.notes.has(time);

            if (inPage) {
              page.notes.set(bigInt(id), null);
            }

            return page;
          });

          return {
            pages: newPages,
            pageParams: d.pageParams,
          };
        }
      );
    } else {
      queryClient.setQueryData(
        queryKey,
        (
          d: { pages: PagedNotesMap[]; pageParams: PageParam[] } | undefined
        ) => {
          if (d === undefined) {
            return {
              pages: [
                {
                  notes: newNoteMap([[time, note]]),
                  newer: null,
                  older: null,
                  total: 1,
                },
              ],
              pageParams: [],
            };
          }

          const lastPage = _.last(d.pages);

          if (lastPage === undefined) {
            return undefined;
          }

          const newLastPage = {
            ...lastPage,
            notes: lastPage.notes.with(time, note),
          };

          const cachedNote = lastPage.notes.get(unixToDa(note.essay.sent));

          if (cachedNote && id !== unixToDa(note.essay.sent).toString()) {
            // remove cached note if it exists
            newLastPage.notes.delete(unixToDa(note.essay.sent));

            // set delivered now that we have the real note
            useNotesStore
              .getState()
              .updateStatus(
                { author: note.essay.author, sent: note.essay.sent },
                'delivered'
              );
          }

          return {
            pages: [...d.pages.slice(0, -1), newLastPage],
            pageParams: d.pageParams,
          };
        }
      );
    }
  } else if ('feels' in noteResponse) {
    queryClient.setQueryData(
      queryKey,
      (d: { pages: PagedNotesMap[]; pageParams: PageParam[] } | undefined) => {
        if (d === undefined) {
          return undefined;
        }

        const { feels } = noteResponse;

        const newPages = d.pages.map((page) => {
          const inPage = page.notes.has(time);

          if (inPage) {
            const note = page.notes.get(time);
            if (!note) {
              return page;
            }
            page.notes.set(time, {
              ...note,
              seal: {
                ...note.seal,
                feels,
              },
            });

            return page;
          }

          return page;
        });

        return {
          pages: newPages,
          pageParams: d.pageParams,
        };
      }
    );
  } else if ('essay' in noteResponse) {
    queryClient.setQueryData(
      queryKey,
      (d: { pages: PagedNotesMap[]; pageParams: PageParam[] } | undefined) => {
        if (d === undefined) {
          return undefined;
        }

        const { essay } = noteResponse;

        const newPages = d.pages.map((page) => {
          const inPage = page.notes.has(time);

          if (inPage) {
            const note = page.notes.get(time);
            if (!note) {
              return page;
            }
            page.notes.set(time, {
              ...note,
              essay,
            });

            return page;
          }

          return page;
        });

        return {
          pages: newPages,
          pageParams: d.pageParams,
        };
      }
    );
  } else if ('quip' in noteResponse) {
    queryClient.setQueryData(
      queryKey,
      (d: { pages: PagedNotesMap[]; pageParams: PageParam[] } | undefined) => {
        if (d === undefined) {
          return undefined;
        }

        const {
          quip: {
            meta: { quipCount, lastQuip, lastQuippers },
          },
        } = noteResponse;

        const newPages = d.pages.map((page) => {
          const inPage = page.notes.has(time);

          if (inPage) {
            const note = page.notes.get(time);
            if (!note) {
              return page;
            }
            page.notes.set(time, {
              ...note,
              seal: {
                ...note.seal,
                meta: {
                  quipCount,
                  lastQuip,
                  lastQuippers,
                },
              },
            });

            return page;
          }

          return page;
        });

        return {
          pages: newPages,
          pageParams: d.pageParams,
        };
      }
    );
  }
};

interface PageParam {
  time: BigInteger;
  direction: string;
}

export function useInfiniteNotes(nest: Nest, initialTime?: string) {
  const [han, flag] = nestToFlag(nest);
  const queryKey = useMemo(() => [han, 'notes', flag, 'infinite'], [han, flag]);

  const invalidate = useRef(
    _.debounce(
      () => {
        queryClient.invalidateQueries({ queryKey, refetchType: 'none' });
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
      event: (data: ShelfResponse) => {
        infiniteNoteUpdater(queryKey, data, initialTime);
        invalidate.current();
      },
    });
  }, [nest, invalidate, queryKey, initialTime]);

  const { data, ...rest } = useInfiniteQuery<PagedNotesMap>({
    queryKey,
    queryFn: async ({ pageParam }: { pageParam?: PageParam }) => {
      let path = '';

      if (pageParam) {
        const { time, direction } = pageParam;
        const ud = decToUd(time.toString());
        path = `/${nest}/notes/${direction}/${ud}/${INITIAL_MESSAGE_FETCH_PAGE_SIZE}/outline`;
      } else if (initialTime) {
        path = `/${nest}/notes/around/${decToUd(initialTime)}/${
          INITIAL_MESSAGE_FETCH_PAGE_SIZE / 2
        }/outline`;
      } else {
        path = `/${nest}/notes/newest/${INITIAL_MESSAGE_FETCH_PAGE_SIZE}/outline`;
      }

      const response = await api.scry<PagedNotes>({
        app: 'channels',
        path,
      });

      const notes = newNoteMap(
        Object.entries(response.notes).map(([k, v]) => [bigInt(udToDec(k)), v])
      );

      return {
        ...response,
        notes,
      };
    },
    getNextPageParam: (lastPage): PageParam | undefined => {
      const { newer } = lastPage;

      if (!newer) {
        return undefined;
      }

      return {
        time: bigInt(newer),
        direction: 'newer',
      };
    },
    getPreviousPageParam: (firstPage): PageParam | undefined => {
      const { older } = firstPage;

      if (!older) {
        return undefined;
      }

      return {
        time: bigInt(older),
        direction: 'older',
      };
    },
    refetchOnMount: true,
    retryOnMount: true,
    retry: false,
  });

  if (data === undefined || data.pages.length === 0) {
    return {
      notes: [] as NoteTuple[],
      data,
      ...rest,
    };
  }

  const notes: NoteTuple[] = data.pages
    .map((page) => page.notes.toArray())
    .flat();

  return {
    notes,
    data,
    ...rest,
  };
}

function removeNoteFromInfiniteQuery(nest: string, time: string) {
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
  nest,
  time,
}: {
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

export function useReplyNote(nest: Nest, id: string | null) {
  const { notes } = useInfiniteNotes(nest);

  return id && notes.find(([k, v]) => k.eq(bigInt(id)));
}

export function useOrderedNotes(
  nest: Nest,
  currentId: bigInt.BigInteger | string
) {
  checkNest(nest);
  const { notes } = useInfiniteNotes(nest);

  if (notes.length === 0) {
    return {
      hasNext: false,
      hasPrev: false,
      nextNote: null,
      prevNote: null,
      sortedOutlines: [],
    };
  }

  const sortedOutlines = notes;

  sortedOutlines.sort(([a], [b]) => b.compare(a));

  const noteId = typeof currentId === 'string' ? bigInt(currentId) : currentId;
  const newest = notes[notes.length - 1]?.[0];
  const oldest = notes[0]?.[0];
  const hasNext = notes.length > 0 && newest && noteId.gt(newest);
  const hasPrev = notes.length > 0 && oldest && noteId.lt(oldest);
  const currentIdx = sortedOutlines.findIndex(([i, _c]) => i.eq(noteId));

  const nextNote = hasNext ? sortedOutlines[currentIdx - 1] : null;
  if (nextNote) {
    prefetchNoteWithComments({
      nest,
      time: udToDec(nextNote[0].toString()),
    });
  }
  const prevNote = hasPrev ? sortedOutlines[currentIdx + 1] : null;
  if (prevNote) {
    prefetchNoteWithComments({
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
    options: {
      refetchOnMount: false,
    },
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

  if (quips === undefined || Object.entries(quips).length === 0) {
    return {
      note: {
        ...note,
        seal: {
          ...note?.seal,
          quips: newQuipMap(),
          lastQuip: null,
        },
      },
      ...rest,
    };
  }

  const diff: [BigInteger, Quip][] = Object.entries(quips).map(([k, v]) => [
    bigInt(udToDec(k)),
    v as Quip,
  ]);

  const quipMap = newQuipMap(diff);

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
  const invalidate = useRef(
    _.debounce(
      () => {
        queryClient.invalidateQueries({
          queryKey: ['briefs'],
          refetchType: 'none',
        });
      },
      300,
      { leading: true, trailing: true }
    )
  );

  const eventHandler = (event: BriefUpdate) => {
    invalidate.current();
    const { brief } = event;

    if (brief !== null) {
      queryClient.setQueryData(['briefs'], (d: Briefs | undefined) => {
        if (d === undefined) {
          return undefined;
        }
        const newBriefs = { ...d };
        newBriefs[event.nest] = brief;
        return newBriefs;
      });
    }
  };

  const { data, ...rest } = useReactQuerySubscription<Briefs, BriefUpdate>({
    queryKey: ['briefs'],
    app: 'channels',
    path: '/briefs',
    scry: '/briefs',
    onEvent: eventHandler,
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

export function useRemoteNote(nest: Nest, id: string, blockLoad: boolean) {
  checkNest(nest);
  const [han, flag] = nestToFlag(nest);
  const path = `/said/${nest}/note/${decToUd(id)}`;
  const { data, ...rest } = useReactQuerySubscribeOnce({
    queryKey: [han, 'said', nest, id],
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

// export function useRemoteQuip(
// nest: Nest,
// noteId: string,
// quipId: string,
// blockLoad: boolean
// ) {
// checkNest(nest);
// const [han, flag] = nestToFlag(nest);
// const path = `/said/${nest}/note/${decToUd(noteId)}/${decToUd(quipId)}`;
// const { data, ...rest } = useReactQuerySubscribeOnce({
// queryKey: [han, 'said', nest, noteId, quipId],
// app: 'channels',
// path,
// options: {
// enabled: !blockLoad,
// },
// });

// if (rest.isLoading || rest.isError || !data) {
// return {} as Quip;
// }

// const { note } = data as Said;

// return note as Quip;
// }

export function useMarkReadMutation() {
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

export function useAddNoteMutation(nest: string) {
  const [han, flag] = nestToFlag(nest);
  const queryKey = useCallback(
    (...args: any[]) => [han, 'notes', flag, ...args],
    [han, flag]
  );

  let timePosted: string;
  const mutationFn = async (variables: {
    cacheId: CacheId;
    essay: NoteEssay;
  }) =>
    new Promise<string>((resolve) => {
      try {
        api
          .trackedPoke<ShelfAction, ShelfResponse>(
            channelNoteAction(nest, {
              add: variables.essay,
            }),
            { app: 'channels', path: `/${nest}/ui` },
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

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries(queryKey());
      // await queryClient.cancelQueries(['briefs']);

      useNotesStore.getState().addTracked(variables.cacheId);

      const sent = unixToDa(variables.essay.sent).toString();
      const note = {
        seal: {
          id: sent,
          quips: newQuipMap(),
          feels: {},
          meta: {
            quipCount: 0,
            lastQuippers: [],
            lastQuip: null,
          },
        },
        essay: variables.essay,
      };

      // for the unlikely case that the user navigates away from the editor
      // before the mutation is complete, or if the host ship is offline,
      // we update the cache optimistically.
      // queryClient.setQueryData<Notes>(queryKey(), (notes) => ({
      // ...(notes || {}),
      // // this time is temporary, and will be replaced by the actual time
      // [variables.essay.sent]: note,
      // }));
      queryClient.setQueryData<Note>(queryKey(variables.cacheId), note);

      infiniteNoteUpdater(queryKey('infinite'), {
        nest,
        response: {
          note: {
            id: sent,
            'r-note': {
              set: note,
            },
          },
        },
      });
    },
    onSuccess: async (_data, variables) => {
      useNotesStore.getState().updateStatus(variables.cacheId, 'sent');
      queryClient.removeQueries(queryKey(variables.cacheId));
    },
    onSettled: async (_data, _error) => {
      await queryClient.invalidateQueries({
        queryKey: queryKey('infinite'),
        refetchType: 'none',
      });
    },
  });
}

export function useEditNoteMutation() {
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
        updater
      );

      await updateNotesInCache(variables, notesUpdater);
    },
  });
}

export function useDeleteNoteMutation() {
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

      await updateNotesInCache(variables, updater);

      await queryClient.cancelQueries([han, 'notes', flag, variables.time]);
    },
    onSuccess: async (_data, variables) => {
      removeNoteFromInfiniteQuery(variables.nest, variables.time);
    },
    onSettled: async (_data, _error, variables) => {
      const [han, flag] = nestToFlag(variables.nest);
      await queryClient.invalidateQueries([han, 'notes', flag]);
      await queryClient.invalidateQueries([han, 'notes', flag, 'infinite']);
    },
  });
}

export function useCreateMutation() {
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
      const notesUpdater = (prev: Record<string, Note | null> | undefined) => {
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
              quipCount: replyingNote.seal.meta.quipCount + 1,
              quippers: [...replyingNote.seal.meta.lastQuippers, window.our],
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

      await updateNotesInCache(variables, notesUpdater);
      await updateNoteInCache(variables, updater);
    },
    onSettled: async (_data, _error, variables) => {
      const [han, flag] = nestToFlag(variables.nest);
      await queryClient.refetchQueries([han, 'notes', flag]);
      await queryClient.refetchQueries([han, 'notes', flag, variables.noteId]);
    },
  });
}

export function useDeleteQuipMutation() {
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
      const notesUpdater = (prev: Record<string, Note | null> | undefined) => {
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
              quipCount: replyingNote.seal.meta.quipCount - 1,
              quippers: replyingNote.seal.meta.lastQuippers.filter(
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

      await updateNoteInCache(variables, updater);
      await updateNotesInCache(variables, notesUpdater);
    },
    onSettled: async (_data, _error, variables) => {
      const [han, flag] = nestToFlag(variables.nest);
      await queryClient.refetchQueries([han, 'notes', flag]);
      await queryClient.refetchQueries([han, 'notes', flag, variables.noteId]);
    },
  });
}

export function useAddNoteFeelMutation() {
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

      await updateNoteInCache(variables, updater);
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

      await updateNoteInCache(variables, updater);
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

      await updateNoteInCache(variables, updater);
    },
  });
}

export function useDeleteQuipFeelMutation() {
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

      await updateNoteInCache(variables, updater);
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
