import produce from 'immer';
import { useCallback } from 'react';
import create from 'zustand';

interface AvatarStore {
  status: Record<string, boolean>;
  loaded: (src: string) => void;
}

const useAvatarStore = create<AvatarStore>((set, get) => ({
  status: {},
  loaded: (src) => {
    set(
      produce((draft) => {
        draft.status[src] = true;
      })
    );
  },
}));

export function useAvatar(src: string) {
  return useAvatarStore(
    useCallback(
      (store: AvatarStore) => ({
        hasLoaded: store.status[src] || false,
        load: () => store.loaded(src),
      }),
      [src]
    )
  );
}

export default useAvatarStore;
