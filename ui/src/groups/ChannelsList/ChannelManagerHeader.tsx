import { useIsMobile } from '@/logic/useMedia';
import { useAmAdmin, useRouteGroup } from '@/state/groups';
import cn from 'classnames';
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
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

  return (
    <div className="my-4 flex w-full flex-col items-center justify-between space-y-2 sm:flex-row sm:space-x-2">
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
              'bg-blue text-center',
              isMobile ? 'small-button' : 'button'
            )}
          >
            New Channel
          </Link>
        </div>
      ) : null}
      <div className="w-full md:w-[300px]">
        <ChannelsListSearch />
      </div>
    </div>
  );
}
