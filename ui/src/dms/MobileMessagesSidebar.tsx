import React, { useRef, useState } from 'react';
import cn from 'classnames';
import { debounce } from 'lodash';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Link } from 'react-router-dom';
import ChatSmallIcon from '@/components/icons/ChatSmallIcon';
import PersonSmallIcon from '@/components/icons/Person16Icon';
import CmdSmallIcon from '@/components/icons/CmdSmallIcon';
import Filter16Icon from '@/components/icons/Filter16Icon';
import AddIcon16 from '@/components/icons/AddIcon';
import { usePinned } from '@/state/chat';
import {
  filters,
  SettingsState,
  SidebarFilter,
  useSettingsState,
} from '@/state/settings';
import { useGroupState } from '@/state/groups';
import { whomIsDm, whomIsMultiDm } from '@/logic/utils';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';
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
  const filteredPins = pinned.filter((p) => {
    const nest = `chat/${p}`;
    const { groups } = useGroupState.getState();
    const groupFlag = Object.entries(groups).find(
      ([, v]) => nest in v.channels
    )?.[0];
    const channel = groups[groupFlag || '']?.channels[nest];
    return !!channel || whomIsDm(p) || whomIsMultiDm(p);
  });

  const setFilterMode = (mode: SidebarFilter) => {
    useSettingsState.getState().putEntry('talk', 'messagesFilter', mode);
  };

  const scroll = useRef(
    debounce((scrolling: boolean) => setIsScrolling(scrolling), 200)
  );

  return (
    <div className="flex h-full w-full flex-col">
      <header className="flex items-center justify-between px-6 pt-10 pb-4">
        <h1 className="text-lg font-bold text-gray-800 sm:text-base">
          Messages
        </h1>
        <div className="flex shrink-0 flex-row items-center space-x-3 self-end">
          <ReconnectingSpinner />
          <Link
            to="/dm/new"
            className="default-focus flex items-center rounded-md bg-blue p-1 text-base"
            aria-label="New Direct Message"
          >
            <AddIcon16 className="h-4 w-4 text-white" />
          </Link>
        </div>
      </header>
      <nav className={cn('flex h-full w-full flex-col bg-white')}>
        <MessagesScrollingContext.Provider value={isScrolling}>
          <MessagesList filter={messagesFilter} isScrolling={scroll.current}>
            {filteredPins && filteredPins.length > 0 ? (
              <div className="px-4">
                <h2 className="my-0.5 p-2 text-lg font-bold text-gray-400 sm:text-base">
                  Pinned Messages
                </h2>
                {pinned.map((ship: string) => (
                  <MessagesSidebarItem key={ship} whom={ship} />
                ))}
              </div>
            ) : null}
            <div className="flex flex-row items-center justify-between px-4">
              <h2 className="my-0.5 p-2 text-lg font-bold text-gray-400 sm:text-base">
                {messagesFilter}
              </h2>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger
                  className={'default-focus -mr-0.5 p-1'}
                  aria-label="Groups Filter Options"
                >
                  <Filter16Icon className="h-4 w-4 text-gray-400" />
                </DropdownMenu.Trigger>
                <DropdownMenu.Content className="dropdown text-gray-600">
                  <DropdownMenu.Item
                    className={cn(
                      'dropdown-item flex items-center space-x-2 rounded-none',
                      messagesFilter === filters.all &&
                        'bg-gray-50 text-gray-800'
                    )}
                    onClick={() => setFilterMode(filters.all)}
                  >
                    <ChatSmallIcon className="mr-2 h-4 w-4" />
                    All Messages
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className={cn(
                      'dropdown-item flex items-center space-x-2 rounded-none',
                      messagesFilter === filters.dms &&
                        'bg-gray-50 text-gray-800'
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
            </div>
          </MessagesList>
        </MessagesScrollingContext.Provider>
      </nav>
    </div>
  );
}
