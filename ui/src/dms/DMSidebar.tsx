import React from 'react';
import cn from 'classnames';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { Link, NavLink } from 'react-router-dom';
import { useDmArchive, useDmList, usePendingDms } from '../state/chat';
import DmSidebarItem from './DMSidebarItem';
import NewMessageIcon from '../components/icons/NewMessageIcon';
import SmallDownIcon from '../components/icons/SmallDownIcon';
import { useIsMobile } from '../logic/useMedia';
import { useSearchParam } from '../hooks';
import DMArchiveItem from './DMArchiveItem';
import CheckIcon from '../components/icons/CheckIcon';
import LeftIcon from '../components/icons/LeftIcon';
import RetainedStateLink from '../components/RetainedStateLink';

export default function DMSidebar() {
  const [showArchive = false] = useSearchParam<boolean>('archive');
  const ships = useDmList();
  const pending = usePendingDms();
  const archive = useDmArchive();
  const isMobile = useIsMobile();

  return (
    <nav
      className={cn(
        'flex h-full min-w-56 flex-col border-r-2 border-gray-50 bg-white',
        isMobile && 'fixed top-0 left-0 z-40 w-full'
      )}
    >
      <header className="flex items-center border-b-2 border-gray-50 p-4">
        {isMobile ? (
          <RetainedStateLink
            to="/"
            className="mr-2 flex items-center"
            aria-label="Back to Home"
          >
            <LeftIcon className="h-5 w-5 text-gray-500" />
          </RetainedStateLink>
        ) : null}
        <h2 className="font-semibold">All Messages</h2>
        {/* <Dropdown.Root>
          <Dropdown.Trigger className="default-focus flex items-center rounded-lg font-semibold">
            {showArchive ? 'Archive' : 'All Messages'}
            <SmallDownIcon className="ml-1 h-4 w-4" />
          </Dropdown.Trigger>
          <Dropdown.Content className="dropdown">
            <Dropdown.Item
              asChild
              className="dropdown-item flex items-center justify-between"
            >
              <Link to="/dm">
                All Messages
                {!showArchive ? (
                  <CheckIcon className="h-6 w-6 text-blue" />
                ) : null}
              </Link>
            </Dropdown.Item>
            <Dropdown.Item
              asChild
              className="dropdown-item flex items-center justify-between"
            >
              <Link to="/dm?archive=true">
                Archive
                {showArchive ? (
                  <CheckIcon className="h-6 w-6 text-blue" />
                ) : null}
              </Link>
            </Dropdown.Item>
          </Dropdown.Content>
        </Dropdown.Root> */}
        <Link
          to="/dm/new"
          className="default-focus ml-auto rounded-lg text-blue"
          aria-label="Start New Message"
        >
          <NewMessageIcon className="h-6 w-6" />
        </Link>
      </header>

      <ul className="flex w-full flex-col p-2">
        {!showArchive ? (
          <>
            {pending.map((ship) => (
              <DmSidebarItem pending key={ship} ship={ship} />
            ))}
            {ships.map((ship) => (
              <DmSidebarItem key={ship} ship={ship} />
            ))}
          </>
        ) : (
          archive.map((ship) => <DMArchiveItem key={ship} ship={ship} />)
        )}
      </ul>
    </nav>
  );
}
