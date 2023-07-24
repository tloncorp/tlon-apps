import { useIsMobile } from '@/logic/useMedia';
import { useAmAdmin, useGroup, useRouteGroup } from '@/state/groups';
import cn from 'classnames';
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import HostConnection from '@/channels/HostConnection';
import { getFlagParts } from '@/logic/utils';
import { useConnectivityCheck } from '@/state/vitals';
import ChannelsListSearch from './ChannelsListSearch';

interface ChannelManagerHeaderProps {
  addSection: () => void;
}

export default function ChannelManagerHeader({
  addSection,
}: ChannelManagerHeaderProps) {
  const location = useLocation();
  const flag = useRouteGroup();
  const isAdmin = useAmAdmin(flag);
  const isMobile = useIsMobile();
  const host = getFlagParts(flag).ship;
  const { data } = useConnectivityCheck(host);
  const group = useGroup(flag);
  const saga = group?.saga || null;
  const hasIssue =
    (saga !== null && !('synced' in saga)) ||
    (data?.status &&
      'complete' in data.status &&
      data.status.complete !== 'yes');

  return (
    <div className="my-4 flex w-full flex-col justify-between space-y-2 sm:flex-row sm:items-center sm:space-x-2">
      {isAdmin ? (
        <div className="mt-2 flex flex-row space-x-2 whitespace-nowrap">
          <button
            className={cn(
              'bg-blue text-center',
              isMobile ? 'small-button' : 'button'
            )}
            onClick={() => addSection()}
          >
            New Section
          </button>
          <Link
            to={`/groups/${flag}/channels/new`}
            state={{ backgroundLocation: location }}
            className={cn(
              'bg-blue-soft text-center text-blue',
              isMobile ? 'small-button' : 'button'
            )}
          >
            New Channel
          </Link>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <ChannelsListSearch className="w-full flex-1 md:w-[300px]" />
        {hasIssue && (
          <HostConnection
            className={cn(isAdmin && 'order-0')}
            ship={host}
            status={data?.status}
            saga={group?.saga || null}
          />
        )}
      </div>
    </div>
  );
}
