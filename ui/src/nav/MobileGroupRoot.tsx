import CaretLeft16Icon from '@/components/icons/CaretLeft16Icon';
import CaretRight16Icon from '@/components/icons/CaretRight16Icon';
import ChannelList from '@/groups/GroupSidebar/ChannelList';
import { useGroupFlag } from '@/state/groups';
import React from 'react';
import { Link } from 'react-router-dom';

export default function MobileGroupRoot() {
  const flag = useGroupFlag();

  return (
    <>
      <header className="flex flex-none items-center   justify-between px-2 py-1">
        <Link
          to="/"
          className="default-focus inline-flex items-center rounded-lg p-2 text-base font-semibold text-gray-800 hover:bg-gray-50"
        >
          <CaretLeft16Icon className="mr-1 h-4 w-4 text-gray-400" />
          Channels
        </Link>
        <Link to="./channels" className="small-secondary-button pr-1">
          <span>All</span>
          <CaretRight16Icon className="ml-1 h-4 w-4 text-gray-400" />
        </Link>
      </header>
      <div className="h-full w-full flex-1 overflow-y-scroll p-2 pr-0">
        <ChannelList flag={flag} />
      </div>
    </>
  );
}
