import React from 'react';
import cn from 'classnames';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { NavLink } from 'react-router-dom';
import { useDmList, usePendingDms } from '../state/chat';
import DmSidebarItem from './DMSidebarItem';
import NewMessageIcon from '../components/icons/NewMessageIcon';
import SmallDownIcon from '../components/icons/SmallDownIcon';
import useMedia from '../logic/useMedia';

export default function DMSidebar() {
  const ships = useDmList();
  const pending = usePendingDms();
  const isMobile = useMedia('(max-width: 639px)');

  return (
    <nav
      className={cn(
        'flex h-full min-w-56 flex-col border-r-2 border-gray-50 bg-white',
        isMobile && 'fixed top-0 left-0 z-40 w-full'
      )}
    >
      <header className="flex items-center border-b-2 border-gray-50 p-4">
        <Dropdown.Root>
          <Dropdown.Trigger className="default-focus flex items-center rounded-lg font-semibold">
            All Messages
            <SmallDownIcon className="ml-1 h-4 w-4" />
          </Dropdown.Trigger>
          <Dropdown.Content className="dropdown">
            <Dropdown.Item asChild className="dropdown-item">
              <NavLink to="/dm">All Messages</NavLink>
            </Dropdown.Item>
            <Dropdown.Item asChild className="dropdown-item">
              <NavLink to="/dm-archive">Archive</NavLink>
            </Dropdown.Item>
          </Dropdown.Content>
        </Dropdown.Root>
        <NavLink
          to="/dm/new"
          className="default-focus ml-auto rounded-lg text-blue"
          aria-label="Start New Message"
        >
          <NewMessageIcon className="h-6 w-6" />
        </NavLink>
      </header>

      <ul className="flex w-full flex-col p-2">
        {pending.map((ship) => (
          <DmSidebarItem pending key={ship} ship={ship} />
        ))}
        {ships.map((ship) => (
          <DmSidebarItem key={ship} ship={ship} />
        ))}
      </ul>
    </nav>
  );
}
