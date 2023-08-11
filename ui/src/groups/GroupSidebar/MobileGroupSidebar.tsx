import React, { useState } from 'react';
import cn from 'classnames';
import { Outlet, useLocation, useMatch } from 'react-router';
import { useAmAdmin, useGroup, useGroupFlag } from '@/state/groups/groups';
import NavTab from '@/components/NavTab';
import HashIcon from '@/components/icons/HashIcon';
import ElipsisIcon from '@/components/icons/EllipsisIcon';
import BellIcon from '@/components/icons/BellIcon';
import Sheet, { SheetContent } from '@/components/Sheet';
import SidebarItem from '@/components/Sidebar/SidebarItem';
import InviteIcon from '@/components/icons/InviteIcon';
import LinkIcon from '@/components/icons/LinkIcon';
import LeaveIcon from '@/components/icons/LeaveIcon';
import PersonIcon from '@/components/icons/PersonIcon';
import { getPrivacyFromGroup } from '@/logic/utils';
import { useIsDark } from '@/logic/useMedia';
import GroupAvatar from '../GroupAvatar';
import { useGroupActions } from '../GroupActions';

export default function MobileGroupSidebar() {
  const { ship } = window;
  const flag = useGroupFlag();
  const group = useGroup(flag);
  const privacy = group ? getPrivacyFromGroup(group) : 'public';
  const matchHome = useMatch('/groups/:ship/:name');
  const matchActivity = useMatch('/groups/:ship/:name/activity');
  const matchInfo = useMatch('/groups/:ship/:name/info');
  const location = useLocation();
  const [showSheet, setShowSheet] = useState(false);
  const { onCopy, copyItemText } = useGroupActions(flag);
  const isAdmin = useAmAdmin(flag);
  const isDarkMode = useIsDark();

  return (
    <section className="fixed inset-0 z-40 flex h-full w-full flex-col border-gray-50 bg-white">
      <Outlet />
      <footer className="flex-none border-t-2 border-gray-50">
        <nav>
          <ul className="flex h-[50px] items-center">
            <NavTab to={`.`} className="basis-1/4">
              <HashIcon
                className={cn(
                  ' h-6 w-6',
                  !matchHome && 'text-gray-200 dark:text-gray-600'
                )}
              />
            </NavTab>
            <NavTab to={`/groups/${flag}/activity`} className="basis-1/4">
              <BellIcon
                isDarkMode={isDarkMode}
                isInactive={!matchActivity}
                className={'h-6 w-6'}
              />
            </NavTab>
            <NavTab
              to={`/groups/${flag}/info`}
              className="basis-1/4"
              state={{ backgroundLocation: location }}
            >
              <GroupAvatar
                {...group?.meta}
                size="h-6 w-6"
                className={cn('', !matchInfo && 'opacity-50 grayscale')}
              />
            </NavTab>
            <NavTab onClick={() => setShowSheet(true)} className="basis-1/4">
              <ElipsisIcon className="h-6 w-6 text-gray-200 dark:text-gray-600" />
            </NavTab>
          </ul>
          <Sheet open={showSheet} onOpenChange={(o) => setShowSheet(o)}>
            <SheetContent showClose={true}>
              <div className="flex flex-col pt-4">
                {(privacy === 'public' || isAdmin) && (
                  <SidebarItem
                    onClick={() => setShowSheet(false)}
                    to={`/groups/${flag}/invite`}
                    state={{ backgroundLocation: location }}
                    icon={
                      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gray-50">
                        <InviteIcon className="h-6 w-6" />
                      </div>
                    }
                  >
                    Invite People
                  </SidebarItem>
                )}
                <SidebarItem
                  icon={
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gray-50">
                      <LinkIcon className="h-6 w-6" />
                    </div>
                  }
                  onClick={onCopy}
                >
                  {copyItemText}
                </SidebarItem>
                {isAdmin && (
                  <SidebarItem
                    onClick={() => setShowSheet(false)}
                    to={`/groups/${flag}/edit`}
                    state={{ backgroundLocation: location }}
                    icon={
                      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gray-50">
                        <PersonIcon className="h-6 w-6" />
                      </div>
                    }
                  >
                    Group Settings
                  </SidebarItem>
                )}
                {flag.includes(ship) ? null : (
                  <SidebarItem
                    onClick={() => setShowSheet(false)}
                    to={`/groups/${flag}/leave`}
                    state={{ backgroundLocation: location }}
                    color="text-red"
                    icon={
                      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-red-soft dark:bg-red-800">
                        <LeaveIcon className="h-6 w-6" />
                      </div>
                    }
                  >
                    Leave Group
                  </SidebarItem>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </nav>
      </footer>
    </section>
  );
}
