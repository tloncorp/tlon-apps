import React, { useRef, useState } from 'react';
import cn from 'classnames';
import { debounce, filter } from 'lodash';
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
import ActionMenu, { Action } from '@/components/ActionMenu';

export default function MobileMessagesSidebar() {
  const [isScrolling, setIsScrolling] = useState(false);
  const messagesFilter = useMessagesFilter();
  const [filterOpen, setFilterOpen] = useState(false);
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

  const filterActions: Action[] = [
    {
      key: 'all',
      type: messagesFilter === filters.all ? 'prominent' : 'default',
      onClick: () => setFilterMode(filters.all),
      content: (
        <div className="flex">
          <ChatSmallIcon className="mr-2 h-4 w-4" />
          All Messages
        </div>
      ),
    },
    {
      key: 'direct',
      type: messagesFilter === filters.dms ? 'prominent' : 'default',
      onClick: () => setFilterMode(filters.dms),
      content: (
        <div className="flex">
          <PersonSmallIcon className="mr-2 h-4 w-4" />
          Direct Messages
        </div>
      ),
    },
    {
      key: 'groups',
      type: messagesFilter === filters.groups ? 'prominent' : 'default',
      onClick: () => setFilterMode(filters.groups),
      content: (
        <div className="flex">
          <CmdSmallIcon className="mr-2 h-4 w-4" />
          Group Talk Channels
        </div>
      ),
    },
  ];

  return (
    <div className="flex h-full w-full flex-col">
      <MobileHeader
        title="Messages"
        action={
          <>
            <ReconnectingSpinner />
            {appName === 'Talk' ? (
              <ActionMenu
                open={filterOpen}
                onOpenChange={setFilterOpen}
                actions={filterActions}
                asChild={false}
                triggerClassName="default-focus -mr-0.5 p-1"
                ariaLabel="Groups Filter Options"
              >
                <FilterIconMobileNav className="h-8 w-8 text-black" />
              </ActionMenu>
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
