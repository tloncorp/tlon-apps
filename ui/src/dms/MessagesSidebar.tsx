import React, { useState, useRef, useCallback } from 'react';
import cn from 'classnames';
import { debounce } from 'lodash';
import { Link, useLocation } from 'react-router-dom';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import AddIcon from '@/components/icons/AddIcon';
import Filter16Icon from '@/components/icons/Filter16Icon';
import { usePinned } from '@/state/chat';
import SidebarItem from '@/components/Sidebar/SidebarItem';
import Avatar from '@/components/Avatar';
import ShipName from '@/components/ShipName';
import TalkIcon from '@/components/icons/TalkIcon';
import MenuIcon from '@/components/icons/MenuIcon';
import ArrowNWIcon from '@/components/icons/ArrowNWIcon';
import {
  filters,
  SidebarFilter,
  useMessagesFilter,
  usePutEntryMutation,
} from '@/state/settings';
import { whomIsDm, whomIsMultiDm } from '@/logic/utils';
import { useGroups } from '@/state/groups';
import ReconnectingSpinner from '@/components/ReconnectingSpinner';
import SystemChrome from '@/components/Sidebar/SystemChrome';
import MessagesList from './MessagesList';
import MessagesSidebarItem from './MessagesSidebarItem';
import { MessagesScrollingContext } from './MessagesScrollingContext';

export function TalkAppMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <SidebarItem
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
          <DropdownMenu.Content className="dropdown">
            <DropdownMenu.Item className="dropdown-item-blue">
              <a
                href="https://airtable.com/shrflFkf5UyDFKhmW"
                target="_blank"
                rel="noreferrer"
              >
                Submit Feedback
              </a>
            </DropdownMenu.Item>
            <DropdownMenu.Item className="dropdown-item">
              <Link to="/about" state={{ backgroundLocation: location }}>
                About Talk
              </Link>
            </DropdownMenu.Item>
            <DropdownMenu.Item className="dropdown-item">
              <Link
                to="/settings"
                className=""
                state={{ backgroundLocation: location }}
              >
                App Settings
              </Link>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      }
    >
      <div className="flex items-center justify-between">
        Talk
        <ReconnectingSpinner className="h-4 w-4 group-hover:hidden" />
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
  const messagesFilter = useMessagesFilter();
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

  const atTopChange = useCallback((top: boolean) => setAtTop(top), []);

  const scroll = useRef(
    debounce((scrolling: boolean) => setIsScrolling(scrolling), 200)
  );

  return (
    <nav className="flex h-full min-w-64 flex-none resize-x flex-col overflow-hidden border-r-2 border-gray-50 bg-white">
      <div
        className={cn('flex w-full flex-col p-2', !atTop && 'bottom-shadow')}
      >
        <TalkAppMenu />
        <SystemChrome />
        <SidebarItem
          icon={<Avatar size="xs" ship={window.our} />}
          to={'/profile/edit'}
        >
          <ShipName showAlias name={window.our} />
        </SidebarItem>
        <SidebarItem
          to="/dm/new"
          inexact
          icon={<AddIcon className="m-1 h-4 w-4" />}
        >
          New Message
        </SidebarItem>
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto">
        <MessagesScrollingContext.Provider value={isScrolling}>
          <MessagesList
            filter={messagesFilter}
            atTopChange={atTopChange}
            isScrolling={scroll.current}
          >
            {filteredPins && filteredPins.length > 0 ? (
              <div className="mb-4 flex flex-col border-t-2 border-gray-50 p-2 px-2 pb-1">
                <h2 className="my-2 px-2 text-sm font-bold text-gray-400">
                  Pinned Messages
                </h2>

                {filteredPins.map((ship: string) => (
                  <MessagesSidebarItem key={ship} whom={ship} />
                ))}
              </div>
            ) : null}

            <div className="flex h-10 items-center justify-between border-t-2 border-gray-50 px-4 pt-2 pb-1">
              <h2 className="text-sm font-bold text-gray-400">
                {messagesFilter}
              </h2>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger
                  className={'default-focus'}
                  aria-label="Groups Filter Options"
                >
                  <Filter16Icon className="w-4 text-gray-400" />
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
          </MessagesList>
        </MessagesScrollingContext.Provider>
      </div>
    </nav>
  );
}
