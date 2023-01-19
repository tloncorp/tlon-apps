import React, { useRef, useState } from 'react';
import cn from 'classnames';
import { debounce } from 'lodash';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Link } from 'react-router-dom';
import Divider from '@/components/Divider';
import CaretDown16Icon from '@/components/icons/CaretDown16Icon';
import ChatSmallIcon from '@/components/icons/ChatSmallIcon';
import PersonSmallIcon from '@/components/icons/Person16Icon';
import CmdSmallIcon from '@/components/icons/CmdSmallIcon';
import NewMessageIcon from '@/components/icons/NewMessageIcon';
import { usePinned } from '@/state/chat';
import {
  filters,
  SettingsState,
  SidebarFilter,
  useSettingsState,
} from '@/state/settings';
import MessagesList from './MessagesList';
import MessagesSidebarItem from './MessagesSidebarItem';
import { MessagesScrollingContext } from './MessagesScrollingContext';

const selMessagesFilter = (s: SettingsState) => ({
  messagesFilter: s.talk.messagesFilter,
});

export default function MobileMessagesSidebar() {
  const [isScrolling, setIsScrolling] = useState(false);
  const { messagesFilter } = useSettingsState(selMessagesFilter);
  const pinned = usePinned();

  const setFilterMode = (mode: SidebarFilter) => {
    useSettingsState.getState().putEntry('talk', 'messagesFilter', mode);
  };

  const scroll = useRef(
    debounce((scrolling: boolean) => setIsScrolling(scrolling), 200)
  );

  return (
    <nav
      className={cn(
        'flex h-full w-full flex-col border-r-2 border-gray-50 bg-white'
      )}
    >
      <MessagesScrollingContext.Provider value={isScrolling}>
        <MessagesList filter={messagesFilter} isScrolling={scroll.current}>
          {pinned && pinned.length > 0 ? (
            <div className="-mb-2 md:mb-0">
              <div className="-mb-2 flex items-center p-2 md:m-0">
                <Divider>Pinned</Divider>
                <div className="grow border-b-2 border-gray-100" />
              </div>
              <div className="flex flex-col space-y-2 px-2 pb-2">
                {pinned.map((ship: string) => (
                  <MessagesSidebarItem key={ship} whom={ship} />
                ))}
              </div>
            </div>
          ) : null}
          <header className="flex flex-none items-center justify-between px-2 py-1">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger
                className={
                  'default-focus flex items-center rounded-lg p-2 text-base font-semibold hover:bg-gray-50'
                }
                aria-label="Groups Filter Options"
              >
                <h1 className="mr-4 text-xl font-medium">{messagesFilter}</h1>
                <CaretDown16Icon className="h-4 w-4 text-gray-400" />
              </DropdownMenu.Trigger>
              <DropdownMenu.Content className="dropdown text-gray-600">
                <DropdownMenu.Item
                  className={cn(
                    'dropdown-item flex items-center space-x-2 rounded-none',
                    messagesFilter === filters.all && 'bg-gray-50 text-gray-800'
                  )}
                  onClick={() => setFilterMode(filters.all)}
                >
                  <ChatSmallIcon className="mr-2 h-4 w-4" />
                  All Messages
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={cn(
                    'dropdown-item flex items-center space-x-2 rounded-none',
                    messagesFilter === filters.dms && 'bg-gray-50 text-gray-800'
                  )}
                  onClick={() => setFilterMode(filters.dms)}
                >
                  <PersonSmallIcon className="mr-2 h-4 w-4" />
                  Direct Messages
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={cn(
                    'dropdown-item flex items-center space-x-2 rounded-none',
                    messagesFilter === filters.groups &&
                      'bg-gray-50 text-gray-800'
                  )}
                  onClick={() => setFilterMode(filters.groups)}
                >
                  <CmdSmallIcon className="mr-2 h-4 w-4" />
                  Group Talk Channels
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
            <Link to="/dm/new" aria-label="New Direct Message" className="mr-2">
              <NewMessageIcon className="h-6 w-6 text-blue" />
            </Link>
          </header>
        </MessagesList>
      </MessagesScrollingContext.Provider>
    </nav>
  );
}
