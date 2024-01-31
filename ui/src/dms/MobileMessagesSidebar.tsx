import { useRef, useState } from 'react';
import cn from 'classnames';
import { debounce } from 'lodash';
import { Link } from 'react-router-dom';
import ChatSmallIcon from '@/components/icons/ChatSmallIcon';
import PersonSmallIcon from '@/components/icons/Person16Icon';
import CmdSmallIcon from '@/components/icons/CmdSmallIcon';
import { usePinnedChats } from '@/state/pins';
import {
  filters,
  SidebarFilter,
  useMessagesFilter,
  usePutEntryMutation,
} from '@/state/settings';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';
import MobileHeader from '@/components/MobileHeader';
import AddIconMobileNav from '@/components/icons/AddIconMobileNav';
import FilterIconMobileNav from '@/components/icons/FilterIconMobileNav';
import ActionMenu, { Action } from '@/components/ActionMenu';
import MessagesList from './MessagesList';
import MessagesSidebarItem from './MessagesSidebarItem';
import { MessagesScrollingContext } from './MessagesScrollingContext';

export default function MobileMessagesSidebar() {
  const [isScrolling, setIsScrolling] = useState(false);
  const messagesFilter = useMessagesFilter();
  const [filterOpen, setFilterOpen] = useState(false);
  const { mutate } = usePutEntryMutation({
    bucket: 'talk',
    key: 'messagesFilter',
  });
  // TODO: may need to tweak
  const pinned = usePinnedChats(true);

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
        <div className="flex items-center">
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
        <div className="flex items-center">
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
        <div className="flex items-center">
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
          <div className="flex h-12 items-center justify-end space-x-2">
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
          </div>
        }
      />
      <nav className={cn('flex h-full w-full flex-col bg-white')}>
        <MessagesScrollingContext.Provider value={isScrolling}>
          <MessagesList
            filter={messagesFilter}
            isScrolling={scroll.current}
          >
            {pinned && pinned.length > 0 ? (
              <>
                <div className="px-4">
                  <h2 className="mb-0.5 p-2 font-sans text-gray-400">Pinned</h2>
                  {pinned.map((ship: string) => (
                    <MessagesSidebarItem key={ship} whom={ship} />
                  ))}
                </div>
                <div className="flex flex-row items-center justify-between px-4">
                  <h2 className="mb-0.5 p-2 font-sans text-gray-400">
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
