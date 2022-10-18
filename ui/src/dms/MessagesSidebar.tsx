import React from 'react';
import cn from 'classnames';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import AddIcon from '@/components/icons/AddIcon';
import { useIsMobile } from '@/logic/useMedia';
import Filter16Icon from '@/components/icons/Filter16Icon';
import CaretDown16Icon from '@/components/icons/CaretDown16Icon';
import { useBriefs, usePinned } from '@/state/chat';
import SidebarItem from '@/components/Sidebar/SidebarItem';
import Avatar from '@/components/Avatar';
import ShipName from '@/components/ShipName';
import TalkIcon from '@/components/icons/TalkIcon';
import {
  filters,
  useSettingsState,
  SidebarFilter,
  SettingsState,
} from '@/state/settings';
import MobileMessagesSidebar from './MobileMessagesSidebar';
import MessagesList from './MessagesList';
import MessagesSidebarItem from './MessagesSidebarItem';

const selMessagesFilter = (s: SettingsState) => ({
  messagesFilter: s.talk.messagesFilter,
});

export default function MessagesSidebar() {
  const isMobile = useIsMobile();
  const { messagesFilter } = useSettingsState(selMessagesFilter);
  const briefs = useBriefs();
  const pinned = usePinned();

  const setFilterMode = (mode: SidebarFilter) => {
    useSettingsState.getState().putEntry('talk', 'messagesFilter', mode);
  };

  if (isMobile) {
    return <MobileMessagesSidebar />;
  }

  return (
    <nav className="flex h-full w-64 flex-none flex-col border-r-2 border-gray-50 bg-white">
      <ul className="flex w-full flex-col space-y-1 px-2 pt-2">
        <SidebarItem
          div
          className="text-black"
          to="/"
          icon={<TalkIcon className="h-6 w-6" />}
        >
          Talk
        </SidebarItem>
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
        {pinned && pinned.length > 0 ? (
          <>
            <li className="-mx-2 mt-5 grow border-t-2 border-gray-50 pt-3 pb-2">
              <span className="ml-4 text-sm font-semibold text-gray-400">
                Pinned Messages
              </span>
            </li>
            {pinned.map((ship: string) => (
              <MessagesSidebarItem
                key={ship}
                whom={ship}
                brief={briefs[ship]}
              />
            ))}
          </>
        ) : null}
        <li className="-mx-2 mt-5 grow border-t-2 border-gray-50 pt-3 pb-2">
          <span className="ml-4 text-sm font-semibold text-gray-400">
            Messages
          </span>
        </li>
        <li className="p-2">
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
                  messagesFilter === filters.all && 'bg-gray-50 text-gray-800'
                )}
                onClick={() => setFilterMode(filters.all)}
              >
                All Messages
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className={cn(
                  'dropdown-item flex items-center space-x-2 rounded-none',
                  messagesFilter === filters.dms && 'bg-gray-50 text-gray-800'
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
        </li>
      </ul>
      <MessagesList filter={messagesFilter} />
    </nav>
  );
}
