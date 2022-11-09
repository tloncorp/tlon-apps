import React from 'react';
import cn from 'classnames';
import { Outlet, useMatch } from 'react-router';
import { useLocation } from 'react-router-dom';
import { useGroup, useGroupFlag } from '@/state/groups/groups';
import NavTab from '@/components/NavTab';
import HashIcon from '@/components/icons/HashIcon';
import InviteIcon16 from '@/components/icons/InviteIcon16';
import GroupAvatar from '../GroupAvatar';

export default function MobileGroupSidebar() {
  const flag = useGroupFlag();
  const group = useGroup(flag);
  const location = useLocation();
  const match = useMatch('/groups/:ship/:name/info');

  return (
    <section className="flex h-full w-full flex-col overflow-x-hidden border-r-2 border-gray-50 bg-white">
      <Outlet />
      <footer className="mt-auto flex-none border-t-2 border-gray-50">
        <nav>
          <ul className="flex items-center">
            <NavTab to="." end aria-label="Channels">
              <HashIcon className="mb-0.5 h-6 w-6" />
              Channels
            </NavTab>
            <NavTab to={`/groups/${flag}/info`}>
              <GroupAvatar
                {...group?.meta}
                size="h-6 w-6"
                className={cn('mb-0.5', !match && 'opacity-50 grayscale')}
              />
              Group Info
            </NavTab>
            <NavTab
              to={`/groups/${flag}/invite`}
              state={{ backgroundLocation: location }}
            >
              <InviteIcon16 className="mb-0.5 h-6 w-6" />
              Invite
            </NavTab>
          </ul>
        </nav>
      </footer>
    </section>
  );
}
