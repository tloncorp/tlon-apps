import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useGroupFlag, useGroup, useAmAdmin } from '@/state/groups';
import ChannelList, { ChannelSorter } from '@/groups/GroupSidebar/ChannelList';
import GroupAvatar from '@/groups/GroupAvatar';
import CaretLeft16Icon from '@/components/icons/CaretLeft16Icon';
import Add16Icon from '@/components/icons/Add16Icon';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';
import HostConnection from '@/channels/HostConnection';
import { getFlagParts } from '@/logic/utils';
import { useConnectivityCheck } from '@/state/vitals';

export default function MobileGroupChannelList() {
  const flag = useGroupFlag();
  const group = useGroup(flag);
  const isAdmin = useAmAdmin(flag);
  const location = useLocation();
  const host = getFlagParts(flag).ship;
  const { data } = useConnectivityCheck(host);
  const saga = group?.saga || null;

  return (
    <>
      <header className="flex items-center justify-between border-b-2 border-gray-50 py-2 pl-2 pr-6">
        <Link
          to="/"
          className="default-focus ellipsis w-max-sm inline-flex h-10 appearance-none items-center justify-center space-x-2 rounded p-2"
          aria-label="Back to All Groups"
        >
          <div className="flex h-6 w-6 items-center justify-center">
            <CaretLeft16Icon className="h-5 w-5 shrink-0 text-gray-600" />
          </div>

          <GroupAvatar {...group?.meta} size="h-6 w-6 flex-none" />
          <div className="flex w-full items-center justify-center space-x-1">
            <h1 className="text-lg font-bold text-gray-800 line-clamp-1">
              {group?.meta.title}
            </h1>
            <HostConnection ship={host} status={data?.status} saga={saga} />
          </div>
        </Link>

        <div className="flex flex-row items-center space-x-3">
          <ReconnectingSpinner />
          <ChannelSorter isMobile={true} />
          {isAdmin && (
            <Link
              className="default-focus flex items-center rounded-md bg-blue p-1 text-base"
              to={`/groups/${flag}/channels/new`}
              state={{ backgroundLocation: location }}
            >
              <Add16Icon className="h-4 w-4 text-white" />
            </Link>
          )}
        </div>
      </header>

      <ChannelList />
    </>
  );
}
