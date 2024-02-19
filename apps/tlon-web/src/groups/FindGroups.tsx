import cn from 'classnames';
import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate, useParams } from 'react-router';
import ob from 'urbit-ob';

import MobileHeader from '@/components/MobileHeader';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';
import ShipConnection from '@/components/ShipConnection';
import ShipSelector, { ShipOption } from '@/components/ShipSelector';
import { useModalNavigate } from '@/logic/routing';
import { useIsMobile } from '@/logic/useMedia';
import { hasKeys, preSig, whomIsFlag } from '@/logic/utils';
import {
  useGangs,
  useGroupIndex,
  usePendingGangsWithoutClaim,
} from '@/state/groups';
import { useConnectivityCheck } from '@/state/vitals';
import { Gangs, ViewProps } from '@/types/groups';

import GroupJoinList, { GroupJoinItem } from './GroupJoinList';
import GroupJoinListPlaceholder from './GroupJoinListPlaceholder';

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

  const flag = name ? preSig(`${ship}/${name}`) : ship ? preSig(ship) : '';
  const gangToDisplay = name ? indexedGangs?.[flag] : null;
  // If needed group found - show it, otherwise show all groups
  const gangsToDisplay = gangToDisplay
    ? { [flag]: gangToDisplay }
    : indexedGangs;
  const hasResults = gangsToDisplay && hasKeys(gangsToDisplay);

  const [shipSelectorShips, setShipSelectorShips] = useState<ShipOption[]>([]);

  const selectedShip =
    shipSelectorShips.length > 0 ? shipSelectorShips[0] : null;
  let presentedShip = selectedShip
    ? selectedShip.label || selectedShip.value
    : '';

  const { data, showConnection } = useConnectivityCheck(ship || presentedShip);
  // Show only the name of the ship if the needed group is not in the results
  if (name && gangsToDisplay && !gangToDisplay) {
    [presentedShip] = presentedShip.split('/');
  }

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
              type="combo"
              ship={ship || `~${presentedShip}`}
              status={data?.status}
              app="channels"
              agent="channels-server"
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

    if (hasResults) {
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

    return (
      <span>
        <div className="mb-3 inline-block rounded bg-gray-50 p-2">
          <ShipConnection
            type="combo"
            ship={ship || `~${presentedShip}`}
            status={data?.status}
            app="channels"
            agent="channels-server"
          />
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
    <div className="flex h-full w-full flex-col overflow-hidden">
      {isMobile && (
        <MobileHeader title="Find Groups" action={<ReconnectingSpinner />} />
      )}
      <div className={cn('grow overflow-y-auto bg-gray-50')}>
        <Helmet>
          <title>{title ? title : document.title}</title>
        </Helmet>
        <div className="w-full p-6">
          {hasKeys(pendingGangs) ? (
            <section className={cn('card mb-6')}>
              <h1 className={cn('mb-4 text-lg font-bold')}>Pending Invites</h1>
              <GroupJoinList highlightAll gangs={pendingGangs} />
            </section>
          ) : null}
          {!selectedShip && (
            <section className={cn('card mb-6')}>
              <h1 className="text-lg font-bold">Some Good Groups</h1>
              <p className="mb-2 mt-4 leading-6 text-gray-600">
                Here are some groups we like.
              </p>
              <GroupJoinItem
                flag="~halbex-palheb/uf-public"
                preload={{
                  title: 'UF',
                  image:
                    'https://interstellar.nyc3.digitaloceanspaces.com/battus-datsun/2022.11.07..19.39.22-Sig.png',
                  description: 'The latest from the Urbit Foundation',
                }}
              />
              <GroupJoinItem
                flag="~natnex-ronret/door-link"
                preload={{
                  title: 'door.link',
                  image: 'https://www.door.link/logowhite.svg',
                  description: 'sound/silence cult',
                }}
              />
              <GroupJoinItem
                flag="~nibset-napwyn/tlon"
                preload={{
                  title: 'Tlon Local',
                  image:
                    'https://fabled-faster.nyc3.cdn.digitaloceanspaces.com/tlon-locals.svg',
                  description:
                    'Updates, announcements, and broadcasts from Tlon',
                }}
              />
            </section>
          )}
          <section className={cn('card mb-6 space-y-8')}>
            <div>
              <h1 className="text-lg font-bold">Join With Code</h1>
              <p className="mb-8 mt-4 leading-6 text-gray-600">
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
              <section>
                <p className="mb-3 font-semibold text-gray-400">
                  {resultsTitle()}
                </p>
                {fetchStatus === 'fetching' ? (
                  <GroupJoinListPlaceholder />
                ) : hasResults ? (
                  <GroupJoinList gangs={gangsToDisplay} />
                ) : null}
              </section>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
