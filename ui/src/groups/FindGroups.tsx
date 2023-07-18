import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import cn from 'classnames';
import ob from 'urbit-ob';
import {
  useGangs,
  useGroupIndex,
  usePendingGangsWithoutClaim,
} from '@/state/groups';
import { useIsMobile } from '@/logic/useMedia';
import ShipSelector, { ShipOption } from '@/components/ShipSelector';
import { Gangs, ViewProps } from '@/types/groups';
import { hasKeys, preSig, whomIsFlag } from '@/logic/utils';
import { useNavigate, useParams, useLocation } from 'react-router';
import { useModalNavigate } from '@/logic/routing';
import GroupReference from '@/components/References/GroupReference';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';
import ShipConnection from '@/components/ShipConnection';
import { useConnectivityCheck } from '@/state/vitals';
import GroupJoinList from './GroupJoinList';
import GroupJoinListPlaceholder from './GroupJoinListPlaceholder';
import GroupAvatar from './GroupAvatar';

export default function FindGroups({ title }: ViewProps) {
  const { ship, name } = useParams<{ ship: string; name: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const modalNavigate = useModalNavigate();
  const existingGangs = useGangs();
  const pendingGangs = usePendingGangsWithoutClaim();
  const isMobile = useIsMobile();
  const { groupIndex, fetchStatus, refetch } = useGroupIndex(ship || '');

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

  const [shipSelectorShips, setShipSelectorShips] = useState<ShipOption[]>([]);

  const selectedShip =
    shipSelectorShips.length > 0 ? shipSelectorShips[0] : null;
  const presentedShip = selectedShip
    ? selectedShip.label || selectedShip.value
    : '';

  const { data, showConnection } = useConnectivityCheck(ship || presentedShip);

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
    if (fetchStatus === 'fetching') {
      return (
        <>
          <div className="mb-3 inline-block rounded bg-gray-50 p-2">
            <ShipConnection
              ship={ship || presentedShip}
              status={data?.status}
            />
          </div>
          <p>
            Searching for groups hosted by&nbsp;
            <span
              onClick={handleProfileClick}
              className="cursor-pointer text-gray-800"
            >
              {presentedShip === '' ? ship : presentedShip}
            </span>
            <span>&nbsp;...</span>
          </p>
        </>
      );
    }

    if (indexedGangs) {
      if (hasKeys(indexedGangs)) {
        return (
          <>
            <div className="mb-3 inline-block rounded bg-gray-50 p-2">
              <ShipConnection
                ship={ship || presentedShip}
                status={data?.status}
              />
            </div>
            <p>
              Groups hosted by&nbsp;
              <span
                onClick={handleProfileClick}
                className="cursor-pointer text-gray-800"
              >
                {presentedShip === '' ? ship : presentedShip}
              </span>
              <span>:</span>
            </p>
          </>
        );
      }
    }

    return (
      <span>
        <div className="mb-3 inline-block rounded bg-gray-50 p-2">
          <ShipConnection ship={ship || presentedShip} status={data?.status} />
        </div>
        <p>
          Your search timed out, which may happen when a ship hosts no groups,
          is under heavy load, or is offline.{' '}
          <span
            onClick={() => refetch()}
            className="cursor-pointer text-gray-800"
          >
            Try again?
          </span>
        </p>
      </span>
    );
  };

  // Allow selecting a ship name or invite URL (i.e., flag) in ShipSelector
  const isValidNewOption = (val: string) =>
    val ? ob.isValidPatp(preSig(val)) || whomIsFlag(val) : false;

  return (
    <>
      {isMobile && (
        <header className="flex items-center justify-between bg-white px-6 py-4 sm:hidden">
          <h1 className="text-lg font-bold text-gray-800">Find Groups</h1>
          <div className="flex shrink-0 flex-row items-center space-x-3 self-end">
            {isMobile && <ReconnectingSpinner />}
          </div>
        </header>
      )}
      <div className={cn('flex grow overflow-y-auto bg-gray-50')}>
        <Helmet>
          <title>{title ? title : document.title}</title>
        </Helmet>
        <div className="w-full p-6">
          {hasKeys(pendingGangs) ? (
            <section className={cn('card mb-6 space-y-4')}>
              <h1
                className={cn('font-bold', isMobile ? 'text-base' : 'text-lg')}
              >
                Pending Invites
              </h1>
              <GroupJoinList gangs={pendingGangs} />
            </section>
          ) : null}
          {!selectedShip && (
            <section className={cn('card mb-6')}>
              <h1 className="text-lg font-bold">Some Good Groups</h1>
              <p className="mb-2 mt-4 leading-6 text-gray-600">
                Here are some groups we like.
              </p>
              <p className="mt-2 mb-8 leading-6 text-gray-600">
                You can find many more in the Urbit Foundation’s{' '}
                <a
                  href="https://urbit.org/ecosystem?type=groups"
                  target="_blank"
                  rel="noreferrer"
                >
                  directory
                </a>
                .
              </p>
              <div className="grid grid-cols-1 gap-4">
                <div className="flex items-center justify-between">
                  <GroupAvatar
                    image="https://interstellar.nyc3.digitaloceanspaces.com/battus-datsun/2022.11.07..19.39.22-Sig.png"
                    size="h-12 w-12 shrink-0"
                  />
                  <div className="mx-2 grow space-y-2">
                    <h2 className="text-base font-semibold">
                      Urbit Foundation
                    </h2>
                    <p className="text-gray-400">
                      Learn about the Urbit project
                    </p>
                  </div>
                  <GroupReference flag="~halbex-palheb/uf-public" onlyButton />
                </div>
                <div className="flex items-center justify-between">
                  <GroupAvatar
                    image="https://www.door.link/logowhite.svg"
                    size="h-12 w-12 shrink-0"
                  />
                  <div className="mx-2 grow space-y-2">
                    <h2 className="text-base font-semibold">door.link</h2>
                    <p className="text-gray-400">A cult of music lovers</p>
                  </div>
                  <GroupReference flag="~natnex-ronret/door-link" onlyButton />
                </div>
                <div className="flex items-center justify-between">
                  <GroupAvatar
                    image="https://nyc3.digitaloceanspaces.com/fabled-faster/fabled-faster/2023.4.06..02.45.53-tlon-local-pin.svg"
                    size="h-12 w-12 shrink-0"
                  />
                  <div className="mx-2 grow space-y-2">
                    <h2 className="text-base font-semibold">Tlon Local</h2>
                    <p className="text-gray-400">
                      Updates, announcements, and broadcasts from Tlon.
                    </p>
                  </div>
                  <GroupReference flag="~nibset-napwyn/tlon" onlyButton />
                </div>
              </div>
            </section>
          )}
          <section className={cn('card mb-6 space-y-8')}>
            <div>
              <h1 className="text-lg font-bold">Join With Code</h1>
              <p className="mt-4 mb-8 leading-6 text-gray-600">
                If you know the{' '}
                <abbr title="~sampel-palnet" className="cursor-help">
                  host ID
                </abbr>{' '}
                or{' '}
                <abbr title="~sampel-palnet/group-name" className="cursor-help">
                  shortcode
                </abbr>{' '}
                of a public group, you can enter it here to join.
              </p>
              <label htmlFor="flag" className="mb-2 block font-semibold">
                Host ID or Shortcode
              </label>
              <div className="flex flex-col space-y-2">
                <ShipSelector
                  ships={shipSelectorShips}
                  setShips={setShipSelectorShips}
                  isMulti={false}
                  isClearable={true}
                  isLoading={fetchStatus === 'fetching'}
                  hasPrompt={false}
                  placeholder={'e.g. ~nibset-napwyn/tlon'}
                  isValidNewOption={isValidNewOption}
                  autoFocus={isMobile ? false : true}
                />
              </div>
            </div>
            {selectedShip || (ship && name) ? (
              <section className="space-y-3">
                <p className="font-semibold text-gray-400">{resultsTitle()}</p>
                {fetchStatus === 'fetching' ? (
                  <GroupJoinListPlaceholder />
                ) : indexedGangs && hasKeys(indexedGangs) ? (
                  <GroupJoinList gangs={indexedGangs} />
                ) : null}
              </section>
            ) : null}
          </section>
        </div>
      </div>
    </>
  );
}
