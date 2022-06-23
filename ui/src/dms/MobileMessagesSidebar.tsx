import React from 'react';
import cn from 'classnames';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Link } from 'react-router-dom';
import CaretDown16Icon from '../components/icons/CaretDown16Icon';
import ChatSmallIcon from '../components/icons/ChatSmallIcon';
import PersonSmallIcon from '../components/icons/Person16Icon';
import CmdSmallIcon from '../components/icons/CmdSmallIcon';
import MessagesList from './MessagesList';
import useNavStore from '../components/Nav/useNavStore';
import AddIcon from '../components/icons/AddIcon';
import useMessagesFilter, { filters } from './useMessagesFilter';
import MessagesSidebarItem from './MessagesSidebarItem';
import { useBriefs, usePinnedChats } from '../state/chat';

export default function MobileMessagesSidebar() {
  const { filter, setFilter } = useMessagesFilter();
  const navPrimary = useNavStore((state) => state.navigatePrimary);
  const briefs = useBriefs();
  const pinned = usePinnedChats();

  return (
    <nav
      className={cn(
        'fixed top-0 left-0 z-40 flex h-full w-full flex-col border-r-2 border-gray-50 bg-white'
      )}
    >
      <header className="flex flex-none items-center justify-between px-2 py-1">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            className={
              'default-focus flex items-center rounded-lg p-2 text-base font-semibold hover:bg-gray-50'
            }
            aria-label="Groups Filter Options"
          >
            <h1 className="mr-4 text-xl font-medium">{filter}</h1>
            <CaretDown16Icon className="h-4 w-4 text-gray-400" />
          </DropdownMenu.Trigger>
          <DropdownMenu.Content className="dropdown text-gray-600">
            <DropdownMenu.Item
              className={cn(
                'dropdown-item flex items-center space-x-2 rounded-none',
                filter === filters.all && 'bg-gray-50 text-gray-800'
              )}
              onClick={() => setFilter(filters.all)}
            >
              <ChatSmallIcon className="mr-2 h-4 w-4" />
              All Messages
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={cn(
                'dropdown-item flex items-center space-x-2 rounded-none',
                filter === filters.dms && 'bg-gray-50 text-gray-800'
              )}
              onClick={() => setFilter(filters.dms)}
            >
              <PersonSmallIcon className="mr-2 h-4 w-4" />
              Direct Messages
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={cn(
                'dropdown-item flex items-center space-x-2 rounded-none',
                filter === filters.groups && 'bg-gray-50 text-gray-800'
              )}
              onClick={() => setFilter(filters.groups)}
            >
              <CmdSmallIcon className="mr-2 h-4 w-4" />
              Group Talk Channels
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
        <Link
          to="/dm/new"
          onClick={() => navPrimary('hidden')}
          aria-label="New Direct Message"
        >
          <AddIcon className="h-6 w-6 text-gray-600" />
        </Link>
      </header>
      {pinned && pinned.length > 0 ? (
        <>
          <div className="mb-1 flex items-center space-x-2 px-4 pt-2">
            <span className="text-sm font-semibold text-gray-400">Pinned</span>
            <div className="grow border-b-2 border-gray-100" />
          </div>
          <div className="flex flex-col space-y-2 px-2 pb-2">
            {pinned.map((ship: string) => (
              <MessagesSidebarItem
                key={ship}
                whom={ship}
                brief={briefs[ship]}
              />
            ))}
          </div>
          <div
            className="border-b-2 border-gray-100 px-2"
            style={{ width: 'calc(100% - 2rem)', margin: '0 auto 0.5rem' }}
          />
        </>
      ) : null}
      <MessagesList filter={filter} />
    </nav>
  );
}
