import classNames from 'classnames';
import React from 'react';
import { useLocation } from 'react-router';
import useSidebars from '../state/sidebars';
import { Group } from '../types/groups';
import { channelHref } from '../utils';
import Divider from './Divider';
import LeftIcon from './icons/LeftIcon';
import XIcon from './icons/XIcon';
import SidebarLink from './Sidebar/SidebarLink';

interface GroupSidebarProps {
  flag: string;
  group: Group;
}

function ChannelList({ group, flag }: { group: Group; flag: string }) {
  return (
    <ul>
      {Object.entries(group.channels).map(([key, channel]) => (
        <li key={key}>
          <SidebarLink to={channelHref(flag, key)}>
            {channel.meta.title || key}
          </SidebarLink>
        </li>
      ))}
    </ul>
  );
}

export default function GroupSidebar({ group, flag }: GroupSidebarProps) {
  const location = useLocation();
  const { channelsOpen, isMobile, transition } = useSidebars();

  return (
    <nav
      className={classNames(
        'h-full border-r-2 border-gray-50 bg-white',
        !isMobile && 'w-64',
        isMobile &&
          'fixed top-0 left-0 z-30 w-full -translate-x-full transition-transform',
        channelsOpen && 'translate-x-0'
      )}
    >
      {isMobile ? (
        <header className="flex items-center border-b-2 border-gray-50 p-4">
          <button
            className="flex items-center text-lg font-semibold text-gray-600"
            onClick={() => transition('groups-open')}
          >
            <LeftIcon className="h-6 w-6" />
            Groups
          </button>
          <button
            className="icon-button ml-auto h-8 w-8"
            onClick={() => transition('closed')}
            aria-label="Close Channels Menu"
          >
            <XIcon className="h-6 w-6" />
          </button>
        </header>
      ) : null}
      <div className="p-2">
        <div className="p-2">
          <h1 className="mb-2 font-semibold">{group.meta.title}</h1>
          <p>{group.meta.description}</p>
        </div>
        <ul>
          <SidebarLink to={`/groups/${flag}/channels/new`}>
            New Channel
          </SidebarLink>
          <SidebarLink to={`/groups/${flag}/members`}>Members</SidebarLink>
          <SidebarLink
            to={`/gangs/~zod/structure`}
            state={{ backgroundLocation: location }}
          >
            Test Overlay
          </SidebarLink>
          <SidebarLink to={`/groups/${flag}/roles`}>Roles</SidebarLink>
          <SidebarLink to={`/groups/${flag}/policy`}>Policy</SidebarLink>
        </ul>
        <Divider>Channels</Divider>
        <ChannelList group={group} flag={flag} />
      </div>
    </nav>
  );
}
