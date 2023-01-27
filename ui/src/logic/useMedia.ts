import { useCallback, useEffect, useState } from 'react';
import create from 'zustand';

interface MediaMatchStore {
  media: {
    [query: string]: boolean;
  };
  setQuery: (query: string, data: boolean) => void;
}

const useMediaMatchStore = create<MediaMatchStore>((set, get) => ({
  media: {},
  setQuery: (query, data) => {
    set((draft) => {
      draft.media[query] = data;
    });
  },
}));

function useQuery(query: string) {
  return useMediaMatchStore(
    useCallback((s) => s.media[query] || false, [query])
  );
}

const queries: string[] = [];

export default function useMedia(mediaQuery: string) {
  const value = useQuery(mediaQuery);

  const update = useCallback(
    (e: MediaQueryListEvent) => {
      useMediaMatchStore.getState().setQuery(mediaQuery, e.matches);
    },
    [mediaQuery]
  );

  useEffect(() => {
    if (queries.includes(mediaQuery)) {
      return;
    }

    const query = window.matchMedia(mediaQuery);
    queries.push(mediaQuery);
    useMediaMatchStore.getState().setQuery(mediaQuery, query.matches);

    query.addEventListener('change', update);
    update({ matches: query.matches } as MediaQueryListEvent);
  }, [update, mediaQuery]);

  return value;
}

export function useIsMobile() {
  return useMedia('(max-width: 767px)');
}

export function useIsDark() {
  return useMedia('(prefers-color-scheme: dark)');
}
