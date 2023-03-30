import _ from 'lodash';
import create from 'zustand';
import api from '@/api';
import { useGroup } from '@/state/groups';
import { useCallback, useEffect, useMemo } from 'react';
import useSchedulerStore from '@/state/scheduler';
import { useChatState } from '@/state/chat';
import { useHeapState } from '@/state/heap/heap';
import { useDiaryState } from '@/state/diary';
import { getNestShip, isChannelImported } from './utils';

interface ChannelAgent {
  pendingImports: Record<string, boolean>;
}

const selPendImports = (s: ChannelAgent) => s.pendingImports;

export function usePendingImports() {
  const chats = useChatState(selPendImports);
  const heaps = useHeapState(selPendImports);
  const diaries = useDiaryState(selPendImports);

  return useMemo(
    () => ({
      ..._.mapKeys(chats, (v, c) => `chat/${c}`),
      ..._.mapKeys(heaps, (v, h) => `heap/${h}`),
      ..._.mapKeys(diaries, (v, d) => `diary/${d}`),
    }),
    [chats, heaps, diaries]
  );
}

export interface MigrationInit {
  wait: string[];
  chat: Record<string, boolean>;
  heap: Record<string, boolean>;
  diary: Record<string, boolean>;
}

interface WaitStore {
  wait: string[];
  fetchData: () => Promise<void>;
}

let initialized = false;
const useWaitStore = create<WaitStore>((set, get) => ({
  initialized: false,
  wait: [],
  fetchData: async () => {
    if (initialized) {
      return;
    }

    initialized = true;

    useSchedulerStore.getState().wait(async () => {
      const { wait, chat, heap, diary } = await api.scry<MigrationInit>({
        app: 'groups-ui',
        path: '/migration',
      });

      useChatState.getState().initImports(chat);
      useHeapState.getState().initImports(heap);
      useDiaryState.getState().initImports(diary);
      set({ wait });
    }, 5);
  },
}));

const selWait = (s: WaitStore) => s.wait;

export function useStartedMigration(flag: string) {
  const wait = useWaitStore(selWait);
  const pendingImports = usePendingImports();
  const group = useGroup(flag);
  const pendingShips = Object.keys(pendingImports).map(getNestShip);

  useEffect(() => {
    useWaitStore.getState().fetchData();
  }, []);

  return {
    hasStarted: useCallback(
      (ship: string) => {
        const inPending = pendingShips.includes(ship) && wait.includes(ship);
        const hasOneMigrated = Object.entries(pendingImports).some(
          ([k, v]) => getNestShip(k) === ship && v
        );
        return !inPending || (inPending && hasOneMigrated);
      },
      [pendingImports, pendingShips, wait]
    ),
    channels: group?.channels,
    pendingImports,
  };
}

export function useHasMigratedChannels(flag: string) {
  const { channels, pendingImports, hasStarted } = useStartedMigration(flag);
  const keys = Object.keys(channels || {});
  return (
    keys.length === 0 ||
    keys.some((k) => {
      const channelImported = isChannelImported(k, pendingImports);
      const shipStarted = hasStarted(getNestShip(k));

      return channelImported && shipStarted;
    })
  );
}
