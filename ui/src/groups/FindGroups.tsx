import React, { useCallback, useEffect, useState } from 'react';
import { useGroupState, usePendingGangs } from '@/state/groups';
import ShipSelector, { ShipOption } from '@/components/ShipSelector';
import { Gangs } from '@/types/groups';
import useRequestState from '@/logic/useRequestState';
import GroupJoinList from './GroupJoinList';

// TODO: how to handle the invite link case?

export default function FindGroups() {
  const [foundGangs, setFoundGangs] = useState<Gangs | null>(null);
  const pendingGangs = usePendingGangs();
  const [shipSelectorShips, setShipSelectorShips] = useState<ShipOption[]>([]);
  const selectedShip =
    shipSelectorShips.length > 0 ? shipSelectorShips[0] : null;
  const presentedShip = selectedShip
    ? selectedShip.label || selectedShip.value
    : '';
  const { isPending, isReady, setPending, setReady } = useRequestState();

  const searchGroups = useCallback(async () => {
    if (!selectedShip) {
      return;
    }
    setFoundGangs(null);
    setPending();
    const results = await useGroupState.getState().index(selectedShip.value);
    setFoundGangs(results);
    setReady();
  }, [selectedShip, setPending, setReady]);

  useEffect(() => {
    if (shipSelectorShips.length > 0) {
      searchGroups();
    }
  }, [searchGroups, shipSelectorShips]);

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
            <section className="card mb-4 space-y-8 p-8">
              <p className="font-semibold text-gray-400">
                {isPending ? (
                  <>
                    <span>Searching for groups hosted by&nbsp;</span>
                    <span className="text-gray-800">{presentedShip}</span>
                    <span>...</span>
                  </>
                ) : isReady ? (
                  <>
                    <span>Groups hosted by&nbsp;</span>
                    <span className="text-gray-800">{presentedShip}</span>
                    <span>:</span>
                  </>
                ) : null}
              </p>
              {isReady && foundGangs ? (
                <GroupJoinList gangs={foundGangs} />
              ) : isReady ? (
                <p>No groups found for &apos;{presentedShip}&apos;</p>
              ) : null}
            </section>
          ) : null}
        </section>
        {Object.keys(pendingGangs).length > 0 ? (
          <section className="card mb-4 space-y-8 p-8">
            <h1 className="text-lg font-bold">Pending Invites</h1>
            <GroupJoinList gangs={pendingGangs} />
          </section>
        ) : null}
      </div>
    </div>
  );
}
