import { useState, useRef, useCallback, useContext } from 'react';
import cn from 'classnames';
import { debounce } from 'lodash';
import { Link, useLocation } from 'react-router-dom';
import AddIcon from '@/components/icons/AddIcon';
import Filter16Icon from '@/components/icons/Filter16Icon';
import { usePinnedChats } from '@/state/pins';
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
import ReconnectingSpinner from '@/components/ReconnectingSpinner';
import SystemChrome from '@/components/Sidebar/SystemChrome';
import ActionMenu, { Action } from '@/components/ActionMenu';
import { DesktopUpdateButton } from '@/components/UpdateNotices';
import { AppUpdateContext } from '@/logic/useAppUpdates';
import CautionIcon from '@/components/icons/CautionIcon';
import { useLocalState } from '@/state/local';
import MessagesList from './MessagesList';
import MessagesSidebarItem from './MessagesSidebarItem';
import { MessagesScrollingContext } from './MessagesScrollingContext';

export function TalkAppMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const actions: Action[] = [
    {
      key: 'sunset',
      onClick: () => {
        useLocalState.setState({ manuallyShowTalkSunset: true });
      },
      content: <span className="text-indigo">Talk is Sunsetting</span>,
    },
    {
      key: 'submit',
      content: (
        <a
          className="no-underline"
          href="https://airtable.com/shrflFkf5UyDFKhmW"
          target="_blank"
          rel="noreferrer"
        >
          Submit Feedback
        </a>
      ),
    },
    {
      key: 'about',
      content: (
        <Link to="/about" state={{ backgroundLocation: location }}>
          About Talk
        </Link>
      ),
    },
    {
      key: 'settings',
      content: (
        <Link
          to="/settings"
          className=""
          state={{ backgroundLocation: location }}
        >
          App Settings
        </Link>
      ),
    },
  ];

  return (
    <ActionMenu
      open={menuOpen}
      onOpenChange={setMenuOpen}
      actions={actions}
      align="start"
    >
      <SidebarItem
        className={cn(
          menuOpen
            ? 'bg-gray-100 text-gray-800'
            : 'text-black hover:text-gray-800',
          'group'
        )}
        icon={
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
        }
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center justify-center">
            Talk <CautionIcon className="ml-2 h-5 w-5 text-indigo" />
          </span>
          <ReconnectingSpinner className="h-4 w-4 group-hover:hidden" />
          <a
            title="Back to Landscape"
            aria-label="Back to Landscape"
            href="/apps/landscape"
            target="_blank"
            rel="noreferrer"
            className={cn(
              'h-6 w-6 no-underline',
              menuOpen ? 'block' : 'hidden group-hover:block'
            )}
            // Prevents the dropdown trigger from being fired (therefore, opening the menu)
            onPointerDown={(e) => {
              e.stopPropagation();
              return false;
            }}
          >
            <ArrowNWIcon className="text-gray-400" />
          </a>
        </div>
      </SidebarItem>
    </ActionMenu>
  );
}

export default function MessagesSidebar() {
  const { needsUpdate } = useContext(AppUpdateContext);
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
      content: 'Group Talk Channels',
      containerClassName: cn(
        'flex items-center space-x-2 rounded-none',
        messagesFilter === filters.groups && 'bg-gray-50 text-gray-800'
      ),
    },
  ];

  return (
    <nav className="flex h-full min-w-64 flex-none resize-x flex-col overflow-hidden border-r-2 border-gray-50 bg-white">
      <div
        className={cn('flex w-full flex-col p-2', !atTop && 'bottom-shadow')}
      >
        {needsUpdate ? <DesktopUpdateButton /> : <TalkAppMenu />}
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
            {pinned && pinned.length > 0 ? (
              <div className="mb-4 flex flex-col border-t-2 border-gray-50 p-2 px-2 pb-1">
                <h2 className="my-2 px-2 text-sm font-bold text-gray-400">
                  Pinned Messages
                </h2>

                {pinned.map((ship: string) => (
                  <MessagesSidebarItem key={ship} whom={ship} />
                ))}
              </div>
            ) : null}

            <div className="flex h-10 items-center justify-between border-t-2 border-gray-50 px-4 pb-1 pt-2">
              <h2 className="text-sm font-bold text-gray-400">
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
      </div>
    </nav>
  );
}
