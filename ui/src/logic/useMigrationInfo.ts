import { useChats } from '@/state/chat';
import { useDiaryState } from '@/state/diary';
import { DiaryState } from '@/state/diary/type';
import { useGroupState } from '@/state/groups';
import { GroupState } from '@/state/groups/type';
import { useHeapState } from '@/state/heap/heap';
import { HeapState } from '@/state/heap/type';
import { useCallback, useMemo } from 'react';
import usePendingImports from './usePendingImports';
import { getFlagParts, getNestShip, isChannelImported } from './utils';

const selStash = (s: HeapState) => s.stash;
const selShelf = (s: DiaryState) => s.shelf;
const getShip = (flag: string) => getFlagParts(flag).ship;

export function useStartedMigration() {
  const chats = useChats();
  const stash = useHeapState(selStash);
  const shelf = useDiaryState(selShelf);
  const ships = useMemo(
    () => [
      ...Object.keys(chats).map(getShip),
      ...Object.keys(stash).map(getShip),
      ...Object.keys(shelf).map(getShip),
    ],
    [chats, stash, shelf]
  );

  return useCallback((ship: string) => ships.includes(ship), [ships]);
}

export function useHasMigratedChannels(flag: string) {
  const pendingImports = usePendingImports();
  const channels = useGroupState(
    useCallback((s: GroupState) => s.groups[flag]?.channels, [flag])
  );
  const hasStarted = useStartedMigration();
  const keys = Object.keys(channels || {});
  return keys.some(
    (k) => isChannelImported(k, pendingImports) && hasStarted(getNestShip(k))
  );
}
