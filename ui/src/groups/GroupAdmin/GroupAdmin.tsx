import React, { useEffect } from 'react';
import cn from 'classnames';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAmAdmin, useRouteGroup, useGroup } from '@/state/groups/groups';
import Dialog from '@/components/Dialog';
import SidebarItem from '@/components/Sidebar/SidebarItem';
import { useDismissNavigate } from '@/logic/routing';
import { useIsMobile } from '@/logic/useMedia';
import HomeIcon from '@/components/icons/HomeIcon';
import AddPersonIcon from '@/components/icons/AddPersonIcon';
import PeopleIcon from '@/components/icons/PeopleIcon';
import BadgeIcon from '@/components/icons/BadgeIcon';
import XIcon from '@/components/icons/XIcon';
import { getFlagParts } from '@/logic/utils';
import HostConnection from '@/channels/HostConnection';
import { useConnectivityCheck } from '@/state/vitals';
import MobileHeader from '@/components/MobileHeader';
import GroupAvatar from '../GroupAvatar';

export default function GroupAdmin() {
  const flag = useRouteGroup();
  const isAdmin = useAmAdmin(flag);
  const group = useGroup(flag);
  const dismiss = useDismissNavigate();
  const isMobile = useIsMobile();
  const host = getFlagParts(flag).ship;
  const { data } = useConnectivityCheck(host || '');

  return (
    <>
      {isMobile && (
        <MobileHeader title="Group Settings" pathBack={`/groups/${flag}`} />
      )}
      <nav className="w-full px-4 md:w-64 md:shrink-0 md:px-1 md:py-2">
        <SidebarItem
          showCaret
          to={`/groups/${flag}/edit/info`}
          icon={
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-50 text-gray-600 md:h-6 md:w-6 md:bg-transparent">
              <HomeIcon className="h-6 w-6" />
            </div>
          }
        >
          Group Info
        </SidebarItem>
        <SidebarItem
          showCaret
          to={`/groups/${flag}/edit/invites-privacy`}
          icon={
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-50 text-gray-600 md:h-6 md:w-6 md:bg-transparent">
              <AddPersonIcon className="h-6 w-6" />
            </div>
          }
        >
          Invites &amp; Privacy
        </SidebarItem>
        <SidebarItem
          showCaret
          to={`/groups/${flag}/edit/members`}
          icon={
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-50 text-gray-600 md:h-6 md:w-6 md:bg-transparent">
              <PeopleIcon className="h-6 w-6" />
            </div>
          }
        >
          Members
        </SidebarItem>
        <SidebarItem
          showCaret
          to={`/groups/${flag}/edit/roles`}
          icon={
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-50 text-gray-600 md:h-6 md:w-6 md:bg-transparent">
              <BadgeIcon className="h-6 w-6" />
            </div>
          }
        >
          Roles
        </SidebarItem>
        <SidebarItem
          showCaret
          to={`/groups/${flag}/edit/delete`}
          icon={
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-50 text-gray-600 md:h-6 md:w-6 md:bg-transparent">
              <XIcon className="m-0.5 h-5 w-5" />
            </div>
          }
        >
          Delete Group
        </SidebarItem>
      </nav>

      {!isMobile && (
        <div className="w-full border-l-2 border-gray-50">
          <Outlet />
        </div>
      )}
    </>
  );
}
