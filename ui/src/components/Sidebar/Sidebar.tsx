import classNames from 'classnames';
import React from 'react';
import { useGroup, useGroupList } from '../../state/groups';
import useSidebars from '../../state/sidebars';
import Divider from '../Divider';
import XIcon from '../icons/XIcon';
import SidebarLink from './SidebarLink';

function GroupItem({ flag }: { flag: string }) {
  const { meta } = useGroup(flag);
  return <SidebarLink to={`/groups/${flag}`}>{meta.title}</SidebarLink>;
}

export default function Sidebar() {
  const groups = useGroupList();
  const { groupsOpen, isMobile, transition } = useSidebars();

  return (
    <nav className="h-full">
      <div
        className={classNames(
          'h-full min-w-56 border-r-2 border-gray-50 bg-white',
          isMobile &&
            'fixed top-0 left-0 z-40 w-full -translate-x-full transition-transform',
          groupsOpen && 'translate-x-0'
        )}
      >
        {isMobile ? (
          <header className="flex items-center border-b-2 border-gray-50 p-4">
            <button
              className="icon-button ml-auto h-8 w-8"
              onClick={() => transition('channels-open')}
              aria-label="Close Channels Menu"
            >
              <XIcon className="h-6 w-6" />
            </button>
          </header>
        ) : null}
        <ul className="p-2">
          <SidebarLink to="/">Groups</SidebarLink>
          <SidebarLink to="/profile">Profile</SidebarLink>
          <SidebarLink to="/groups/new">New Group</SidebarLink>
          <Divider>All Groups</Divider>
          {groups.map((flag) => (
            <GroupItem key={flag} flag={flag} />
          ))}
        </ul>
      </div>
    </nav>
  );
}
