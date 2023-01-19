import React, { useState, useRef, useCallback, useMemo } from 'react';
import cn from 'classnames';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import AddIcon from '@/components/icons/AddIcon';
import Filter16Icon from '@/components/icons/Filter16Icon';
import CaretDown16Icon from '@/components/icons/CaretDown16Icon';
import { useBriefs, usePinned } from '@/state/chat';
import SidebarItem from '@/components/Sidebar/SidebarItem';
import Avatar from '@/components/Avatar';
import ShipName from '@/components/ShipName';
import TalkIcon from '@/components/icons/TalkIcon';
import MenuIcon from '@/components/icons/MenuIcon';
import ArrowNWIcon from '@/components/icons/ArrowNWIcon';
import {
  filters,
  useSettingsState,
  SidebarFilter,
  SettingsState,
} from '@/state/settings';
import { debounce } from 'lodash';
import MessagesList from './MessagesList';
import MessagesSidebarItem from './MessagesSidebarItem';
import { MessagesScrollingContext } from './MessagesScrollingContext';

const selMessagesFilter = (s: SettingsState) => ({
  messagesFilter: s.talk.messagesFilter,
});

export function TalkAppMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <SidebarItem
      div
      className={cn(
        menuOpen
          ? 'bg-gray-100 text-gray-800'
          : 'text-black hover:text-gray-800',
        'group'
      )}
      icon={
        <DropdownMenu.Root onOpenChange={() => setMenuOpen(!menuOpen)}>
          <DropdownMenu.Trigger asChild className="appearance-none">
            <div className={cn('h-6 w-6 rounded group-hover:bg-gray-100')}>
              <TalkIcon
                className={cn(
                  'h-6 w-6',
                  menuOpen ? 'hidden' : 'group-hover:hidden'
                )}
              />
              <MenuIcon
                aria-label="Open Menu"
                className={cn(
                  'm-1 h-4 w-4 text-gray-800',
                  menuOpen ? 'block' : 'hidden group-hover:block'
                )}
              />
            </div>
          </DropdownMenu.Trigger>

          <DropdownMenu.Content className="dropdown mt-2 -ml-2 w-60">
            <a
              className="no-underline"
              href="https://airtable.com/shrflFkf5UyDFKhmW"
              target="_blank"
              rel="noreferrer"
            >
              <DropdownMenu.Item className="dropdown-item pl-3 text-blue">
                Submit Feedback
              </DropdownMenu.Item>
            </a>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      }
    >
      <div className="flex items-center justify-between">
        Talk
        <a
          title="Back to Landscape"
          aria-label="Back to Landscape"
          href="/apps/grid"
          target="_blank"
          rel="noreferrer"
          className={cn(
            'h-6 w-6 no-underline',
            menuOpen ? 'block' : 'hidden group-hover:block'
          )}
        >
          <ArrowNWIcon className="text-gray-400" />
        </a>
      </div>
    </SidebarItem>
  );
}

export default function MessagesSidebar() {
  const [atTop, setAtTop] = useState(true);
  const [isScrolling, setIsScrolling] = useState(false);
  const { messagesFilter } = useSettingsState(selMessagesFilter);
  const pinned = usePinned();

  const setFilterMode = (mode: SidebarFilter) => {
    useSettingsState.getState().putEntry('talk', 'messagesFilter', mode);
  };

  const atTopChange = useCallback((top: boolean) => setAtTop(top), []);

  const scroll = useRef(
    debounce((scrolling: boolean) => setIsScrolling(scrolling), 200)
  );

  return (
    <nav className="flex h-full w-64 flex-none flex-col border-r-2 border-gray-50 bg-white">
      <ul
        className={cn(
          'flex w-full flex-col space-y-1 px-2 pt-2',
          !atTop && 'bottom-shadow'
        )}
      >
        <TalkAppMenu />
        <div className="h-5" />
        <SidebarItem
          icon={<Avatar size="xs" ship={window.our} />}
          to={'/profile/edit'}
        >
          <ShipName showAlias name={window.our} />
        </SidebarItem>
        <SidebarItem to="/dm/new" icon={<AddIcon className="m-1 h-4 w-4" />}>
          New Message
        </SidebarItem>
      </ul>
      <MessagesScrollingContext.Provider value={isScrolling}>
        <MessagesList
          filter={messagesFilter}
          atTopChange={atTopChange}
          isScrolling={scroll.current}
        >
          <div className="flex w-full flex-col space-y-3 overflow-x-hidden px-2 sm:space-y-1">
            {pinned && pinned.length > 0 ? (
              <>
                <div className="-mx-2 mt-5 grow border-t-2 border-gray-50 pt-3 pb-2">
                  <span className="ml-4 text-sm font-semibold text-gray-400">
                    Pinned Messages
                  </span>
                </div>
                {pinned.map((ship: string) => (
                  <MessagesSidebarItem key={ship} whom={ship} />
                ))}
              </>
            ) : null}
            <div className="-mx-2 mt-5 grow border-t-2 border-gray-50 pt-3 pb-2">
              <span className="ml-4 text-sm font-semibold text-gray-400">
                Messages
              </span>
            </div>
            <div className="p-2">
              <DropdownMenu.Root>
                <DropdownMenu.Trigger
                  className={
                    'default-focus flex w-full items-center justify-between space-x-2 rounded-lg bg-gray-50 px-2 py-1 text-sm font-semibold'
                  }
                  aria-label="Groups Filter Options"
                >
                  <span className="flex items-center">
                    <Filter16Icon className="w-4 text-gray-400" />
                    <span className="pl-1">Filter: {messagesFilter}</span>
                  </span>
                  <CaretDown16Icon className="w-4 text-gray-400" />
                </DropdownMenu.Trigger>
                <DropdownMenu.Content className="dropdown w-56 text-gray-600">
                  <DropdownMenu.Item
                    className={cn(
                      'dropdown-item flex items-center space-x-2 rounded-none',
                      messagesFilter === filters.all &&
                        'bg-gray-50 text-gray-800'
                    )}
                    onClick={() => setFilterMode(filters.all)}
                  >
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
                    Group Channels
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            </div>
          </div>
        </MessagesList>
      </MessagesScrollingContext.Provider>
    </nav>
  );
}
