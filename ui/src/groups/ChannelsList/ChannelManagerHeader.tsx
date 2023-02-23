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
    <div
      className={cn('my-3 flex items-center justify-between', {
        'flex-col': isMobile,
      })}
    >
      <div>
        {isAdmin ? (
          <div
            className={cn({
              'mb-2': isMobile,
            })}
          >
            <button
              className={cn('mx-2 bg-blue', {
                button: !isMobile,
                'small-button text-center': isMobile,
              })}
              onClick={() => addSection()}
            >
              New Section
            </button>
            <Link
              to={`/groups/${flag}/channels/new`}
              state={{ backgroundLocation: location }}
              className={cn('bg-blue', {
                button: !isMobile,
                'small-button text-center': isMobile,
              })}
            >
              New Channel
            </Link>
          </div>
        ) : null}
      </div>
      <ChannelsListSearch />
    </div>
  );
}
