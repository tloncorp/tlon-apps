import CaretLeftIcon from '@/components/icons/CaretLeftIcon';
import ChannelList from '@/groups/GroupSidebar/ChannelList';
import { useGroupFlag } from '@/state/groups';
import React from 'react';
import { Link } from 'react-router-dom';

export default function MobileGroupRoot() {
  const flag = useGroupFlag();

  return (
    <>
      <header className="flex-none px-2 py-1">
        <Link
          to="/"
          className="default-focus inline-flex items-center rounded-lg p-2 text-xl font-medium text-gray-800 hover:bg-gray-50"
        >
          <CaretLeftIcon className="mr-4 h-6 w-6 text-gray-400" />
          Channels
        </Link>
      </header>
      <div className="h-full w-full flex-1 overflow-y-scroll p-2 pr-0">
        <ChannelList flag={flag} />
      </div>
    </>
  );
}
