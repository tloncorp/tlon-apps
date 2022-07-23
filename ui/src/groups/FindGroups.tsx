import React, { useCallback, useEffect, useState } from 'react';
import { useGangs, useGroupState, usePendingGangs } from '@/state/groups';
import ShipSelector, { ShipOption } from '@/components/ShipSelector';
import { Gangs, GroupIndex } from '@/types/groups';
import useRequestState from '@/logic/useRequestState';
import { hasKeys } from '@/logic/utils';
import GroupJoinList from './GroupJoinList';
import GroupJoinListPlaceholder from './GroupJoinListPlaceholder';

export default function FindGroups() {
  const [foundIndex, setFoundIndex] = useState<GroupIndex | null>(null);
  const existingGangs = useGangs();
  const pendingGangs = usePendingGangs();
  // For search results, only show Public and Private gangs
  // Filter out those with invites, since they will be displayed in the
  // Pending Invites section below
  const publicAndPrivateGangs = foundIndex
    ? Object.entries(foundIndex)
        .filter(([, preview]) => preview && !('afar' in preview.cordon))
        .reduce(
          (memo, [flag, preview]) => ({
            ...memo,
            [flag]: {
              preview,
              invite: null,
              claim: flag in existingGangs ? existingGangs[flag].claim : null,
            },
          }),
          {} as Gangs
        )
    : null;
  const [shipSelectorShips, setShipSelectorShips] = useState<ShipOption[]>([]);
  const selectedShip =
    shipSelectorShips.length > 0 ? shipSelectorShips[0] : null;
  const presentedShip = selectedShip
    ? selectedShip.label || selectedShip.value
    : '';
  const { isPending, setPending, setReady } = useRequestState();

  const searchGroups = useCallback(async () => {
    if (!selectedShip) {
      return;
    }
    setFoundIndex(null);
    setPending();
    const results = await useGroupState.getState().index(selectedShip.value);
    setFoundIndex(results);
    setReady();
  }, [selectedShip, setPending, setReady]);

  useEffect(() => {
    if (selectedShip) {
      searchGroups();
    }
  }, [searchGroups, selectedShip]);

  const resultsTitle = () => {
    if (isPending) {
      return (
        <>
          <span>Searching for groups hosted by&nbsp;</span>
          <span className="text-gray-800">{presentedShip}</span>
          <span>&nbsp;...</span>
        </>
      );
    }

    if (publicAndPrivateGangs) {
      if (hasKeys(publicAndPrivateGangs)) {
        return (
          <>
            <span>Groups hosted by&nbsp;</span>
            <span className="text-gray-800">{presentedShip}</span>
            <span>:</span>
          </>
        );
      }

      return <span>This ship doesn&apos;t host any groups</span>;
    }

    return null;
  };

  return (
    <div className="flex grow bg-gray-50">
      <div className="w-full max-w-3xl p-4">
        <section className="card mb-4 space-y-8 p-8">
          <h1 className="text-lg font-bold">Find Groups</h1>
          <div>
            <label htmlFor="flag" className="mb-1.5 block font-semibold">
              Join Groups via Nickname or Urbit ID
            </label>
            <div className="flex flex-col space-y-2">
              <ShipSelector
                ships={shipSelectorShips}
                setShips={setShipSelectorShips}
                isMulti={false}
                isClearable={true}
                isLoading={isPending}
                hasPrompt={false}
                placeholder={''}
              />
            </div>
          </div>
          {selectedShip ? (
            <section className="space-y-3">
              <p className="font-semibold text-gray-400">{resultsTitle()}</p>
              {isPending ? (
                <GroupJoinListPlaceholder />
              ) : publicAndPrivateGangs && hasKeys(publicAndPrivateGangs) ? (
                <GroupJoinList gangs={publicAndPrivateGangs} />
              ) : null}
            </section>
          ) : null}
        </section>
        {hasKeys(pendingGangs) ? (
          <section className="card mb-4 space-y-8 p-8">
            <h1 className="text-lg font-bold">Pending Invites</h1>
            <GroupJoinList gangs={pendingGangs} />
          </section>
        ) : null}
      </div>
    </div>
  );
}
