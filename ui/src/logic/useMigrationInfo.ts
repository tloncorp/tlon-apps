import { useGroupState } from '@/state/groups';
import { GroupState } from '@/state/groups/type';
import { useCallback } from 'react';
import usePendingImports from './usePendingImports';
import { getNestShip, isChannelImported } from './utils';

export function useStartedMigration() {
  const pendingImports = usePendingImports();
  const pendingShips = Object.keys(pendingImports).map(getNestShip);

  return useCallback(
    (ship: string) => {
      const inPending = pendingShips.includes(ship);
      const hasOneMigrated = Object.entries(pendingImports).some(
        ([k, v]) => getNestShip(k) === ship && v
      );
      return !inPending || (inPending && hasOneMigrated);
    },
    [pendingImports, pendingShips]
  );
}

export function useHasMigratedChannels(flag: string) {
  const pendingImports = usePendingImports();
  const channels = useGroupState(
    useCallback((s: GroupState) => s.groups[flag]?.channels, [flag])
  );
  const hasStarted = useStartedMigration();
  const keys = Object.keys(channels || {});
  return (
    keys.length === 0 ||
    keys.some((k) => {
      const channelImported = isChannelImported(k, pendingImports);
      const shipStarted = hasStarted(getNestShip(k));
      console.log(k, channelImported, shipStarted, pendingImports);

      return channelImported && shipStarted;
    })
  );
}
