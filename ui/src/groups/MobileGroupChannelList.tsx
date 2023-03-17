import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useGroupFlag, useGroup, useAmAdmin } from '@/state/groups';
import ChannelList, { ChannelSorter } from '@/groups/GroupSidebar/ChannelList';
import GroupAvatar from '@/groups/GroupAvatar';
import CaretLeft16Icon from '@/components/icons/CaretLeft16Icon';
import Add16Icon from '@/components/icons/Add16Icon';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';

export default function MobileGroupChannelList() {
  const flag = useGroupFlag();
  const group = useGroup(flag);
  const isAdmin = useAmAdmin(flag);
  const location = useLocation();

  return (
    <>
      <header className="flex items-center justify-between px-6 pt-10 pb-4">
        <Link
          to="/"
          className="default-focus inline-flex items-center text-base font-semibold text-gray-800"
        >
          <CaretLeft16Icon className="mr-2 h-4 w-4 shrink-0 text-gray-400" />
          <GroupAvatar {...group?.meta} size="h-6 w-6" className="mr-3" />
          <h1 className="shrink text-lg font-bold text-gray-800 line-clamp-1">
            {group?.meta.title}
          </h1>
        </Link>

        <div className="flex flex-row items-center space-x-3 self-end">
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
