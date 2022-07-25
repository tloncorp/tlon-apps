import React, { useCallback, useEffect, useState } from 'react';
import ob from 'urbit-ob';
import { useGangs, useGroupState, usePendingGangs } from '@/state/groups';
import ShipSelector, { ShipOption } from '@/components/ShipSelector';
import { Gangs, GroupIndex } from '@/types/groups';
import useRequestState from '@/logic/useRequestState';
import { hasKeys, preSig, whomIsFlag } from '@/logic/utils';
import { useNavigate, useParams } from 'react-router';
import GroupJoinList from './GroupJoinList';
import GroupJoinListPlaceholder from './GroupJoinListPlaceholder';

export default function FindGroups() {
  const { ship, name } = useParams<{ ship: string; name: string }>();
  const navigate = useNavigate();
  const [groupIndex, setGroupIndex] = useState<GroupIndex | null>(null);
  const existingGangs = useGangs();
  const pendingGangs = usePendingGangs();
  /**
   *  Search results for render:
   *
   *  - Filter out index results for gangs with invites, since they will be
   *    displayed in the Pending Invites section below.
   *  - Only show Public and Private groups, unless already a member of a ship's
   *    Secret group
   * */
  const indexGangs = groupIndex
    ? Object.entries(groupIndex)
        .filter(([flag, preview]) => {
          // Show Secret groups if already a member
          if (flag in existingGangs) {
            return !!preview;
          }

          // Otherwise, filter them out
          return preview && !('afar' in preview.cordon);
        })
        .reduce((memo, [flag, preview]) => {
          // Invite URL case: only show the linked group
          if (name) {
            return flag === preSig(`${ship}/${name}`)
              ? {
                  ...memo,
                  [flag]: {
                    preview,
                    invite: null,
                    claim:
                      flag in existingGangs ? existingGangs[flag].claim : null,
                  },
                }
              : memo;
          }

          // Otherwise, show all indexed groups
          return {
            ...memo,
            [flag]: {
              preview,
              invite: null,
              claim: flag in existingGangs ? existingGangs[flag].claim : null,
            },
          };
        }, {} as Gangs)
    : null;
  const [shipSelectorShips, setShipSelectorShips] = useState<ShipOption[]>([]);

  const selectedShip =
    shipSelectorShips.length > 0 ? shipSelectorShips[0] : null;
  const presentedShip = selectedShip
    ? selectedShip.label || selectedShip.value
    : '';
  const { isPending, setPending, setReady } = useRequestState();

  const searchGroups = useCallback(async () => {
    if (!ship) {
      return;
    }

    setGroupIndex(null);
    setPending();
    const results = await useGroupState.getState().index(ship);
    setGroupIndex(results);
    setReady();
  }, [setPending, setReady, ship]);

  // if ship in query params, do query
  useEffect(() => {
    if (!ship) {
      return;
    }

    searchGroups();
  }, [ship, searchGroups]);

  // once a ship is selected, redirect to find/[selected query]
  useEffect(() => {
    if (selectedShip) {
      navigate(`/groups/find/${selectedShip.value}`);
      return;
    }

    // user has cleared selection, redirect back to find root
    navigate('/groups/find');
  }, [navigate, selectedShip]);

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

    if (indexGangs) {
      if (hasKeys(indexGangs)) {
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

  // Allow selecting a ship name or invite URL (i.e., flag) in ShipSelector
  const isValidNewOption = (val: string) =>
    val ? ob.isValidPatp(preSig(val)) || whomIsFlag(val) : false;

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
                isValidNewOption={isValidNewOption}
              />
            </div>
          </div>
          {selectedShip ? (
            <section className="space-y-3">
              <p className="font-semibold text-gray-400">{resultsTitle()}</p>
              {isPending ? (
                <GroupJoinListPlaceholder />
              ) : indexGangs && hasKeys(indexGangs) ? (
                <GroupJoinList gangs={indexGangs} />
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
