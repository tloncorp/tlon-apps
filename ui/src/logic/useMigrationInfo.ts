import _ from 'lodash';
import create from 'zustand';
import api from '@/api';
import { useGroupState } from '@/state/groups';
import { GroupState } from '@/state/groups/type';
import { useCallback, useEffect } from 'react';
import { getNestShip, isChannelImported } from './utils';
import usePendingImports from './usePendingImports';

interface WaitStore {
  wait: string[];
  fetchWait: () => Promise<void>;
}

let initialized = false;
const useWaitStore = create<WaitStore>((set, get) => ({
  initialized: false,
  wait: [],
  fetchWait: async () => {
    if (initialized) {
      return;
    }

    initialized = true;
    const wait = await api.scry<string[]>({
      app: 'group-store',
      path: '/wait',
    });

    set({ wait });
    api.subscribe({
      app: 'group-store',
      path: '/wait',
      event: (newWait: string[]) => {
        set({ wait: newWait });
      },
    });
  },
}));

const selWait = (s: WaitStore) => s.wait;

export function useStartedMigration(flag: string) {
  const wait = useWaitStore(selWait);
  const pendingImports = usePendingImports();
  const channels = useGroupState(
    useCallback((s: GroupState) => s.groups[flag]?.channels, [flag])
  );
  const pendingShips = Object.keys(pendingImports).map(getNestShip);

  useEffect(() => {
    useWaitStore.getState().fetchWait();
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
    channels,
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
