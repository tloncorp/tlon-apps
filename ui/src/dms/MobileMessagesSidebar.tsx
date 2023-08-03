import React, { useRef, useState } from 'react';
import cn from 'classnames';
import { debounce } from 'lodash';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Link } from 'react-router-dom';
import ChatSmallIcon from '@/components/icons/ChatSmallIcon';
import PersonSmallIcon from '@/components/icons/Person16Icon';
import CmdSmallIcon from '@/components/icons/CmdSmallIcon';
import { usePinned } from '@/state/chat';
import {
  filters,
  SidebarFilter,
  useMessagesFilter,
  usePutEntryMutation,
} from '@/state/settings';
import { useGroups } from '@/state/groups';
import { whomIsDm, whomIsMultiDm } from '@/logic/utils';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';
import MobileHeader from '@/components/MobileHeader';
import AddIconMobileNav from '@/components/icons/AddIconMobileNav';
import FilterIconMobileNav from '@/components/icons/FilterIconMobileNav';
import useAppName from '@/logic/useAppName';
import MessagesList from './MessagesList';
import MessagesSidebarItem from './MessagesSidebarItem';
import { MessagesScrollingContext } from './MessagesScrollingContext';

export default function MobileMessagesSidebar() {
  const [isScrolling, setIsScrolling] = useState(false);
  const messagesFilter = useMessagesFilter();
  const appName = useAppName();
  const { mutate } = usePutEntryMutation({
    bucket: 'talk',
    key: 'messagesFilter',
  });
  const pinned = usePinned();
  const groups = useGroups();
  const filteredPins = pinned.filter((p) => {
    const nest = `chat/${p}`;
    const groupFlag = Object.entries(groups).find(
      ([, v]) => nest in v.channels
    )?.[0];
    const channel = groups[groupFlag || '']?.channels[nest];
    return !!channel || whomIsDm(p) || whomIsMultiDm(p);
  });

  const setFilterMode = (mode: SidebarFilter) => {
    mutate({ val: mode });
  };

  const scroll = useRef(
    debounce((scrolling: boolean) => setIsScrolling(scrolling), 200)
  );

  return (
    <div className="flex h-full w-full flex-col pt-4">
      <MobileHeader
        title="Messages"
        action={
          <>
            <ReconnectingSpinner />
            {appName === 'Talk' ? (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger
                  className={'default-focus -mr-0.5 p-1'}
                  aria-label="Groups Filter Options"
                >
                  <FilterIconMobileNav className="h-8 w-8 text-black" />
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
            ) : null}
            <Link
              to="/dm/new"
              className="default-focus flex items-center text-base"
              aria-label="New Direct Message"
            >
              <AddIconMobileNav className="h-8 w-8 text-black" />
            </Link>
          </>
        }
      />
      <nav className={cn('flex h-full w-full flex-col bg-white')}>
        <MessagesScrollingContext.Provider value={isScrolling}>
          <MessagesList filter={messagesFilter} isScrolling={scroll.current}>
            {filteredPins && filteredPins.length > 0 ? (
              <>
                <div className="px-4">
                  <h2 className="my-0.5 p-2 text-lg font-bold text-gray-400 sm:text-base">
                    Pinned Messages
                  </h2>
                  {pinned.map((ship: string) => (
                    <MessagesSidebarItem key={ship} whom={ship} />
                  ))}
                </div>
                <div className="flex flex-row items-center justify-between px-4">
                  <h2 className="my-0.5 p-2 text-lg font-bold text-gray-400 sm:text-base">
                    {messagesFilter}
                  </h2>
                </div>
              </>
            ) : null}
          </MessagesList>
        </MessagesScrollingContext.Provider>
      </nav>
    </div>
  );
}
