import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import classNames from 'classnames';
import { useGroup, useGroupState, useRouteGroup } from '../state/groups';
import { Group } from '../types/groups';
import api from '../api';
import SidebarLink from '../components/Sidebar/SidebarLink';
import Divider from '../components/Divider';
import { channelHref } from '../utils';
import useSidebars from '../state/sidebars';
import XIcon from '../components/icons/XIcon';
import LeftIcon from '../components/icons/LeftIcon';

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

function Groups() {
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const { channelsOpen, isMobile, transition } = useSidebars();

  useEffect(() => {
    let id = null as number | null;
    useGroupState
      .getState()
      .initialize(flag)
      .then((i) => {
        id = i;
      });
    return () => {
      if (id) {
        api.unsubscribe(id);
      }
    };
  }, [flag]);
  const location = useLocation();
  if (!group) {
    return null;
  }
  return (
    <div className="flex grow">
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
        <div className="h-full overflow-y-auto p-2">
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
      <Outlet />
    </div>
  );
}

export default Groups;
