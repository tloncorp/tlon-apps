import { useCallback, useEffect, useState } from 'react';
import create from 'zustand';

interface QueryData {
  initialized: boolean;
  value: boolean;
}

interface MediaMatchStore {
  media: {
    [query: string]: QueryData;
  };
  setQuery: (query: string, data: QueryData) => void;
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
    useCallback(
      (s) =>
        s.media[query] || {
          initialized: false,
          value: false,
        },
      [query]
    )
  );
}

export default function useMedia(mediaQuery: string) {
  const { initialized, value } = useQuery(mediaQuery);

  const update = useCallback(
    (e: MediaQueryListEvent) => {
      useMediaMatchStore.getState().setQuery(mediaQuery, {
        initialized: true,
        value: e.matches,
      });
    },
    [mediaQuery]
  );

  useEffect(() => {
    if (initialized) {
      return;
    }

    const query = window.matchMedia(mediaQuery);
    useMediaMatchStore.getState().setQuery(mediaQuery, {
      initialized: true,
      value: false,
    });

    query.addEventListener('change', update);
    update({ matches: query.matches } as MediaQueryListEvent);
    /* eslint-disable-next-line consistent-return */
    return () => {
      query.removeEventListener('change', update);
    };
  }, [initialized, update, mediaQuery]);

  return value;
}

export function useIsMobile() {
  return useMedia('(max-width: 767px)');
}
