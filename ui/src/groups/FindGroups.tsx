import React, { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import cn from 'classnames';
import ob from 'urbit-ob';
import {
  useGangs,
  useGroupState,
  usePendingGangsWithoutClaim,
} from '@/state/groups';
import { useIsMobile } from '@/logic/useMedia';
import ShipSelector, { ShipOption } from '@/components/ShipSelector';
import { Gangs, GroupIndex, ViewProps } from '@/types/groups';
import useRequestState from '@/logic/useRequestState';
import { hasKeys, preSig, whomIsFlag } from '@/logic/utils';
import { useNavigate, useParams, useLocation } from 'react-router';
import asyncCallWithTimeout from '@/logic/asyncWithTimeout';
import { useModalNavigate } from '@/logic/routing';
import GroupJoinList from './GroupJoinList';
import GroupJoinListPlaceholder from './GroupJoinListPlaceholder';

export default function FindGroups({ title }: ViewProps) {
  const { ship, name } = useParams<{ ship: string; name: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const modalNavigate = useModalNavigate();
  const [groupIndex, setGroupIndex] = useState<GroupIndex | null>(null);
  const existingGangs = useGangs();
  const pendingGangs = usePendingGangsWithoutClaim();
  const isMobile = useIsMobile();

  /**
   *  Search results for render:
   *
   *  - Filter out index results for gangs with invites, since they will be
   *    displayed in the Pending Invites section below.
   *  - Only show Public and Private groups, unless already a member of a ship's
   *    Secret group
   * */
  const indexedGangs = groupIndex
    ? Object.entries(groupIndex)
        .filter(([flag, preview]) => {
          if (flag in existingGangs) {
            // Bucket invites separately (in Pending Invites section)
            if (existingGangs[flag].invite) {
              return false;
            }
            // Show group if already a member
            return true;
          }

          // Hide secret gangs
          return !('afar' in preview.cordon);
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

  useEffect(() => {
    if (indexedGangs && hasKeys(indexedGangs)) {
      const indexedFlags = Object.keys(indexedGangs);
      if (indexedFlags.every((f) => f in existingGangs)) {
        // The gangs state has already been merged with the indexed gangs,
        // so no need to update again
        return;
      }
      useGroupState.setState((draft) => ({
        gangs: { ...draft.gangs, ...indexedGangs },
      }));
    }
  }, [existingGangs, indexedGangs]);

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
    try {
      // @ts-expect-error results will always either be a GroupIndex, or the
      // request will throw an error, which will be caught below
      const results: GroupIndex = await asyncCallWithTimeout(
        useGroupState.getState().index(preSig(ship)),
        10 * 1000
      );
      setGroupIndex(results);
      setReady();
    } catch (error) {
      console.log(
        '[FindGroups:SearchGroups] Request failed due to timeout or network issue'
      );
      setGroupIndex({});
      setReady(); // TODO: show error state? e.g. request timed out... or "Is the host online?"
    }
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
      navigate(`/find/${selectedShip.value}`);
      return;
    }

    if (ship && name) {
      navigate(`/find/${ship}/${name}`);
      return;
    }

    // user has cleared selection, redirect back to find root
    navigate('/find');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShip]);

  const handleProfileClick = () => {
    modalNavigate(`/profile/${preSig(ship!)}`, {
      state: { backgroundLocation: location },
    });
  };

  const resultsTitle = () => {
    if (isPending) {
      return (
        <>
          <span>Searching for groups hosted by&nbsp;</span>
          <span
            onClick={handleProfileClick}
            className="cursor-pointer text-gray-800"
          >
            {presentedShip === '' ? ship : presentedShip}
          </span>
          <span>&nbsp;...</span>
        </>
      );
    }

    if (indexedGangs) {
      if (hasKeys(indexedGangs)) {
        return (
          <>
            <span>Groups hosted by&nbsp;</span>
            <span
              onClick={handleProfileClick}
              className="cursor-pointer text-gray-800"
            >
              {presentedShip === '' ? ship : presentedShip}
            </span>
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
    <>
      {isMobile && (
        <header className="flex h-14 items-center justify-between px-5 py-4">
          <h1 className="text-base font-bold">Find Groups</h1>
        </header>
      )}
      <div
        className={cn('flex grow overflow-y-auto', !isMobile && 'bg-gray-50')}
      >
        <Helmet>
          <title>{title ? title : document.title}</title>
        </Helmet>
        <div className="w-full p-4">
          <section
            className={cn('mb-8 space-y-8', !isMobile && 'card mb-4 sm:p-8')}
          >
            {!isMobile && <h1 className="text-lg font-bold">Find Groups</h1>}
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
            {selectedShip || (ship && name) ? (
              <section className="space-y-3">
                <p className="font-semibold text-gray-400">{resultsTitle()}</p>
                {isPending ? (
                  <GroupJoinListPlaceholder />
                ) : indexedGangs && hasKeys(indexedGangs) ? (
                  <GroupJoinList gangs={indexedGangs} />
                ) : null}
              </section>
            ) : null}
          </section>
          {hasKeys(pendingGangs) ? (
            <section
              className={cn(
                'mb-4 space-y-4',
                !isMobile && 'card space-y-8 sm:p-8'
              )}
            >
              <h1
                className={cn('font-bold', isMobile ? 'text-base' : 'text-lg')}
              >
                Pending Invites
              </h1>
              <GroupJoinList gangs={pendingGangs} />
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
