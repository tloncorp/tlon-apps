import React from 'react';
import cn from 'classnames';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import AsteriskIcon from '@/components/icons/Asterisk16Icon';
import NewMessageIcon from '@/components/icons/NewMessageIcon';
import { useIsMobile } from '@/logic/useMedia';
import CaretDown16Icon from '@/components/icons/CaretDown16Icon';
import ChatSmallIcon from '@/components/icons/ChatSmallIcon';
import PersonSmallIcon from '@/components/icons/Person16Icon';
import CmdSmallIcon from '@/components/icons/CmdSmallIcon';
import { useBriefs, usePinned } from '@/state/chat';
import SidebarItem from '@/components/Sidebar/SidebarItem';
import ActivityIndicator from '@/components/Sidebar/ActivityIndicator';
import Avatar from '@/components/Avatar';
import ShipName from '@/components/ShipName';
import { useNotifications } from '@/notifications/useNotifications';
import MobileMessagesSidebar from './MobileMessagesSidebar';
import MessagesList from './MessagesList';
import useMessagesFilter, { filters } from './useMessagesFilter';
import MessagesSidebarItem from './MessagesSidebarItem';

export default function MessagesSidebar() {
  const isMobile = useIsMobile();
  const { filter, setFilter } = useMessagesFilter();
  const briefs = useBriefs();
  const pinned = usePinned();
  const { count } = useNotifications();

  if (isMobile) {
    return <MobileMessagesSidebar />;
  }

  return (
    <nav className="flex h-full w-64 flex-none flex-col border-r-2 border-gray-50 bg-white">
      <ul className="flex w-full flex-col px-2 pt-2">
        <SidebarItem
          icon={<Avatar size="xs" ship={window.our} />}
          to={'/profile/edit'}
        >
          <ShipName showAlias name={window.our} />
        </SidebarItem>
        <SidebarItem
          icon={<ActivityIndicator count={count} />}
          to={`/notifications`}
        >
          Notifications
        </SidebarItem>
        <SidebarItem
          to="/dm/new"
          color="text-blue"
          highlight="bg-blue-soft dark:bg-blue-900 hover:bg-blue-soft hover:dark:bg-blue-900"
          icon={<NewMessageIcon className="h-6 w-6" />}
        >
          New Message
        </SidebarItem>
        <a
          className="no-underline"
          href="https://github.com/tloncorp/homestead/issues/new?assignees=&labels=bug&template=bug_report.md&title=chat:"
          target="_blank"
          rel="noreferrer"
        >
          <SidebarItem
            color="text-yellow-600 dark:text-yellow-500"
            highlight="bg-yellow-soft hover:bg-yellow-soft hover:dark:bg-yellow-800"
            icon={<AsteriskIcon className="m-1 h-4 w-4" />}
          >
            Submit Issue
          </SidebarItem>
        </a>
        {pinned && pinned.length > 0 ? (
          <>
            <li className="flex items-center space-x-2 p-2">
              <span className="text-xs font-semibold text-gray-400">
                Pinned
              </span>
              <div className="grow border-b-2 border-gray-100" />
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
        <li className="p-2">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger
              className={
                'default-focus flex items-center space-x-2 rounded-lg bg-gray-50 p-2 text-base font-semibold'
              }
              aria-label="Groups Filter Options"
            >
              <span className="pl-1">{filter}</span>
              <CaretDown16Icon className="w-4 text-gray-400" />
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
        </li>
      </ul>
      <MessagesList filter={filter} />
    </nav>
  );
}
