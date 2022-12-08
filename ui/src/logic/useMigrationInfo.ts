import _ from 'lodash';
import { useGroupState } from '@/state/groups';
import { GroupState } from '@/state/groups/type';
import { Channels } from '@/types/groups';
import { useCallback, useEffect, useMemo } from 'react';
import usePendingImports from './usePendingImports';
import { getNestShip, isChannelImported } from './utils';
import asyncCallWithTimeout from './asyncWithTimeout';

const selPreviews = (s: GroupState) => s.channelPreviews;
const inProgress: Record<string, boolean> = {};
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
      if (!isOurs(k) && !(k in previews) && !inProgress[k] && !disable) {
        inProgress[k] = true;

        asyncCallWithTimeout(
          useGroupState.getState().channelPreview(k),
          10 * 1000
        ).finally(() => {
          inProgress[k] = false;
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

  return {
    hasStarted: useCallback(
      (ship: string) => {
        const inPending = pendingShips.includes(ship);
        const hasOneMigrated = Object.entries(toCheck).some(
          ([k, v]) => getNestShip(k) === ship && v
        );
        return !inPending || (inPending && hasOneMigrated);
      },
      [toCheck, pendingShips]
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
