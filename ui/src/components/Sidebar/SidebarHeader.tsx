import React, { useState } from 'react';
import cn from 'classnames';
import { Link } from 'react-router-dom';
import { useLocation } from 'react-router';
import SidebarItem from '@/components/Sidebar/SidebarItem';
import ArrowNWIcon from '../icons/ArrowNWIcon';
import MenuIcon from '../icons/MenuIcon';
import ReconnectingSpinner from '../ReconnectingSpinner';
import ActionMenu, { Action } from '../ActionMenu';
import TlonIcon from '../icons/TlonIcon';
import { LeapShortcutIcon } from './SystemChrome';
import useLeap from '../Leap/useLeap';

const SidebarHeader = React.memo(() => {
  const { setIsOpen: setLeapOpen } = useLeap();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const actions: Action[] = [
    {
      key: 'submit',
      content: (
        <div onClick={() => setLeapOpen(true)}>
          <LeapShortcutIcon className="text-indigo" />
        </div>
      ),
    },
    {
      key: 'landscape',
      content: (
        <a className="dropdown-item no-underline" href={window.location.origin}>
          Back to Landscape
        </a>
      ),
    },
    {
      key: 'about',
      content: (
        <Link to="/about" state={{ backgroundLocation: location }}>
          About Groups
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
  ];

  return (
    <ActionMenu
      open={menuOpen}
      onOpenChange={setMenuOpen}
      actions={actions}
      align="start"
      className="w-full"
      contentClassName="w-[238px]"
    >
      <SidebarItem
        className={cn(
          menuOpen
            ? 'bg-gray-100 text-gray-800'
            : 'text-black hover:text-gray-800',
          'group'
        )}
        icon={
          <div
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded group-hover:bg-gray-100'
            )}
          >
            <TlonIcon
              className={cn(
                'm-1 h-[18px] w-[18px]',
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
          Tlon
          <ReconnectingSpinner
            className={cn(
              'h-4 w-4 group-hover:hidden',
              menuOpen ? 'hidden' : 'block'
            )}
          />
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
});

export default SidebarHeader;
