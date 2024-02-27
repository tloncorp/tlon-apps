import cn from 'classnames';
import { debounce } from 'lodash';
import { useCallback, useRef, useState } from 'react';

import ActionMenu, { Action } from '@/components/ActionMenu';
import Filter16Icon from '@/components/icons/Filter16Icon';
import MessagesList from '@/dms/MessagesList';
import { MessagesScrollingContext } from '@/dms/MessagesScrollingContext';
import MessagesSidebarItem from '@/dms/MessagesSidebarItem';
import TalkHead from '@/dms/TalkHead';
import { usePinnedChats } from '@/state/pins';
import {
  SidebarFilter,
  filters,
  useMessagesFilter,
  usePutEntryMutation,
} from '@/state/settings';

export default function MessagesSidebar({
  searchQuery,
}: {
  searchQuery?: string;
}) {
  const [atTop, setAtTop] = useState(true);
  const [isScrolling, setIsScrolling] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const messagesFilter = useMessagesFilter();
  const { mutate } = usePutEntryMutation({
    bucket: 'talk',
    key: 'messagesFilter',
  });
  const pinned = usePinnedChats();

  const setFilterMode = (mode: SidebarFilter) => {
    mutate({ val: mode });
  };

  const atTopChange = useCallback((top: boolean) => setAtTop(top), []);

  const scroll = useRef(
    debounce((scrolling: boolean) => setIsScrolling(scrolling), 200)
  );

  const filterActions: Action[] = [
    {
      key: 'all',
      onClick: () => setFilterMode(filters.all),
      content: 'All Messages',
      containerClassName: cn(
        'flex items-center space-x-2 rounded-none',
        messagesFilter === filters.all && 'bg-gray-50 text-gray-800'
      ),
    },
    {
      key: 'direct',
      onClick: () => setFilterMode(filters.dms),
      content: 'Direct Messages',
      containerClassName: cn(
        'flex items-center space-x-2 rounded-none',
        messagesFilter === filters.dms && 'bg-gray-50 text-gray-800'
      ),
    },
    {
      key: 'groups',
      onClick: () => setFilterMode(filters.groups),
      content: 'Chat Channels',
      containerClassName: cn(
        'flex items-center space-x-2 rounded-none',
        messagesFilter === filters.groups && 'bg-gray-50 text-gray-800'
      ),
    },
  ];

  return (
    <MessagesScrollingContext.Provider value={isScrolling}>
      <TalkHead />
      <MessagesList
        filter={messagesFilter}
        searchQuery={searchQuery}
        atTopChange={atTopChange}
        isScrolling={scroll.current}
      >
        {pinned && pinned.length > 0 ? (
          <div className="mb-4 flex flex-col border-t-2 border-gray-50 p-2 px-2 pb-1">
            <h2 className="my-2 px-2 text-sm font-semibold text-gray-400">
              Pinned Messages
            </h2>

            {pinned.map((ship: string) => (
              <MessagesSidebarItem key={ship} whom={ship} />
            ))}
          </div>
        ) : null}

        <div className="flex h-10 items-center justify-between border-t-2 border-gray-50 px-4 pb-1 pt-2">
          <h2 className="text-sm font-semibold text-gray-400">
            {messagesFilter}
          </h2>
          <ActionMenu
            open={filterOpen}
            onOpenChange={setFilterOpen}
            actions={filterActions}
            asChild={false}
            triggerClassName="default-focus"
            contentClassName="w-56 text-gray-600"
            ariaLabel="Groups Filter Options"
          >
            <Filter16Icon className="w-4 text-gray-400" />
          </ActionMenu>
        </div>
      </MessagesList>
    </MessagesScrollingContext.Provider>
  );
}
