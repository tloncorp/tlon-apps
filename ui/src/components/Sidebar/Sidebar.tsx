import classNames from 'classnames';
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ModalLocationState } from '../../hooks/routing';
import useMedia from '../../hooks/useMedia';
import { useGangList, useGroup, useGroupList } from '../../state/groups';
import Divider from '../Divider';
import GangName from '../GangName/GangName';
import XIcon from '../icons/XIcon';
import SidebarLink from './SidebarLink';

function GroupItem({ flag }: { flag: string }) {
  const { meta } = useGroup(flag);
  return <SidebarLink to={`/groups/${flag}`}>{meta.title}</SidebarLink>;
}

function GangItem(props: { flag: string }) {
  const { flag } = props;
  return (
    <SidebarLink to={`/gangs/${flag}`}>
      <GangName flag={flag} />
    </SidebarLink>
  );
}

export default function Sidebar() {
  const groups = useGroupList();
  const gangs = useGangList();
  const location = useLocation();
  const isMobile = useMedia('(max-width: 639px)');
  const routeState = location.state as ModalLocationState;

  return (
    <nav className="h-full">
      <div
        className={classNames(
          'h-full min-w-56 border-r-2 border-gray-50 bg-white',
          isMobile && 'fixed top-0 left-0 z-50 w-full'
        )}
      >
        {isMobile ? (
          <header className="flex items-center border-b-2 border-gray-50 p-4">
            {routeState.backgroundLocation ? (
              <Link
                to={routeState.backgroundLocation}
                className="icon-button ml-auto h-8 w-8"
                aria-label="Close Main Menu"
              >
                <XIcon className="h-6 w-6" />
              </Link>
            ) : null}
          </header>
        ) : null}
        <ul className="p-2">
          <SidebarLink to="/">Groups</SidebarLink>
          <SidebarLink to="/profile">Profile</SidebarLink>
          <SidebarLink to="/groups/new">New Group</SidebarLink>
          <SidebarLink to="/groups/join">Join Group</SidebarLink>
          <Divider>All Groups</Divider>
          {groups.map((flag) => (
            <GroupItem key={flag} flag={flag} />
          ))}
          {gangs.length > 0 ? <Divider>Pending</Divider> : null}
          {gangs.map((flag) => (
            <GangItem key={flag} flag={flag} />
          ))}
        </ul>
      </div>
    </nav>
  );
}
