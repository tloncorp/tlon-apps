import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useGroupFlag, useGroup, useAmAdmin } from '@/state/groups';
import ChannelList, { ChannelSorter } from '@/groups/GroupSidebar/ChannelList';
import GroupAvatar from '@/groups/GroupAvatar';
import CaretLeftIcon from '@/components/icons/CaretLeft16Icon';
import AddIcon from '@/components/icons/AddIcon';

export default function MobileGroupRoot() {
  const flag = useGroupFlag();
  const group = useGroup(flag);
  const isAdmin = useAmAdmin(flag);
  const location = useLocation();

  return (
    <>
      <header className="flex items-center justify-between p-4 pt-3 pr-5">
        <div>
          <Link
            to="/"
            className="default-focus inline-flex items-center text-base font-semibold text-gray-800 hover:bg-gray-50"
          >
            <CaretLeftIcon className="mr-2 h-6 w-6 shrink-0 text-gray-400" />
            <GroupAvatar {...group?.meta} size="h-8 w-8" className="mr-3" />
            <h1 className="shrink text-base font-bold line-clamp-1">
              {group?.meta.title}
            </h1>
          </Link>
        </div>
        <div>
          <div className="flex items-center space-x-5">
            <ChannelSorter isMobile={true} />
            {isAdmin && (
              <Link
                className="default-focus flex items-center rounded bg-blue p-1 text-base font-semibold"
                to={`/groups/${flag}/channels/new`}
                state={{ backgroundLocation: location }}
              >
                <AddIcon className="h-4 w-4 text-white" />
              </Link>
            )}
          </div>
        </div>
      </header>
      <div className="h-full w-full flex-1 overflow-y-scroll p-2 pr-0">
        <ChannelList flag={flag} />
      </div>
    </>
  );
}
