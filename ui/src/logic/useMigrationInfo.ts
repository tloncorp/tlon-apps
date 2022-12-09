import _ from 'lodash';
import create from 'zustand';
import api from '@/api';
import { useGroupState } from '@/state/groups';
import { GroupState } from '@/state/groups/type';
import { Channels } from '@/types/groups';
import { useCallback, useEffect, useMemo } from 'react';
import { getNestShip, isChannelImported } from './utils';
import asyncCallWithTimeout from './asyncWithTimeout';
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

const selPreviews = (s: GroupState) => s.channelPreviews;

interface PreviewCheck {
  inProgress: boolean;
  attempted: number;
}

const tracked: Record<string, PreviewCheck> = {};
const isOurs = (nest: string) => getNestShip(nest) === window.our;

export function useCheckUnjoinedMigrations(
  channels: Channels,
  pendingImports: Record<string, boolean>,
  disable: boolean
) {
  const previews = useGroupState(selPreviews);
  const unjoined = _.pickBy(channels, (v, k) => !(k in pendingImports));

  useEffect(() => {
    Object.entries(unjoined).forEach(([k, v]) => {
      const { attempted, inProgress } = tracked[k] || {
        inProgress: false,
        attempted: 0,
      };
      const pastWaiting = Date.now() - attempted >= 10 * 60 * 1000; // wait 10 mins

      if (
        !isOurs(k) &&
        !(k in previews) &&
        !inProgress &&
        pastWaiting &&
        !disable
      ) {
        tracked[k] = {
          inProgress: true,
          attempted: Date.now(),
        };

        asyncCallWithTimeout(
          useGroupState.getState().channelPreview(k),
          10 * 1000
        ).finally(() => {
          tracked[k].inProgress = false;
        });
      }
    });
  }, [previews, unjoined, disable]);

  return useMemo(
    () => _.mapValues(unjoined, (v, k) => k in previews || isOurs(k)),
    [unjoined, previews]
  );
}

export function useStartedMigration(flag: string, onlyPending = false) {
  const wait = useWaitStore(selWait);
  const pendingImports = usePendingImports();
  const channels = useGroupState(
    useCallback((s: GroupState) => s.groups[flag]?.channels, [flag])
  );
  const unjoinedMigrations = useCheckUnjoinedMigrations(
    channels,
    pendingImports,
    onlyPending
  );
  const migrations = useMemo(
    () => ({
      ...pendingImports,
      ...unjoinedMigrations,
    }),
    [pendingImports, unjoinedMigrations]
  );
  const toCheck = onlyPending ? pendingImports : migrations;
  const pendingShips = Object.keys(toCheck).map(getNestShip);

  useEffect(() => {
    useWaitStore.getState().fetchWait();
  }, []);

  return {
    hasStarted: useCallback(
      (ship: string) => {
        const inPending = pendingShips.includes(ship) && wait.includes(ship);
        const hasOneMigrated = Object.entries(toCheck).some(
          ([k, v]) => getNestShip(k) === ship && v
        );
        return !inPending || (inPending && hasOneMigrated);
      },
      [toCheck, pendingShips, wait]
    ),
    channels,
    pendingImports,
  };
}

export function useHasMigratedChannels(flag: string) {
  const { channels, pendingImports, hasStarted } = useStartedMigration(
    flag,
    true
  );
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
