import React from 'react';
import cn from 'classnames';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
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
import ShipConnection from '@/components/ShipConnection';
import { useConnectivityCheck } from '@/state/vitals';
import GroupAvatar from '../GroupAvatar';

export default function GroupAdmin() {
  const { state } = useLocation();
  const flag = useRouteGroup();
  const isAdmin = useAmAdmin(flag);
  const group = useGroup(flag);
  const dismiss = useDismissNavigate();
  const isMobile = useIsMobile();
  const host = getFlagParts(flag).ship;
  const { data, showConnection } = useConnectivityCheck(host || '');

  const onOpenChange = (open: boolean) => {
    if (!open) {
      dismiss();
    }
  };

  return (
    <Dialog
      defaultOpen
      modal
      onOpenChange={onOpenChange}
      close="header"
      className="h-[90vh] w-[90vw] overflow-hidden p-0 sm:h-[75vh] sm:max-h-[800px] sm:w-[75vw] sm:max-w-[800px]"
      onInteractOutside={(e) => e.preventDefault()}
    >
      {isAdmin ? (
        <div className="flex h-full w-full flex-col">
          <div className="flex items-center space-x-2 border-b-2 border-b-gray-50 p-4">
            <GroupAvatar image={group?.meta.image} title={group?.meta.title} />
            <h2 className="font-semibold">Settings</h2>
          </div>
          <div className="flex h-full flex-col overflow-hidden sm:flex-row">
            <aside className="order-2 flex flex-col p-2 sm:order-1 sm:h-full sm:w-[266px]">
              <nav className="grow">
                <SidebarItem
                  to={`/groups/${flag}/edit`}
                  icon={<HomeIcon className="h-6 w-6" />}
                  state={{ backgroundLocation: state.backgroundLocation }}
                >
                  Group Info
                </SidebarItem>
                <SidebarItem
                  to={`/groups/${flag}/edit/invites-privacy`}
                  icon={<AddPersonIcon className="h-6 w-6" />}
                  state={{ backgroundLocation: state.backgroundLocation }}
                >
                  Invites &amp; Privacy
                </SidebarItem>
                <SidebarItem
                  to={`/groups/${flag}/edit/members`}
                  icon={<PeopleIcon className="h-6 w-6" />}
                  state={{ backgroundLocation: state.backgroundLocation }}
                >
                  Members
                </SidebarItem>
                <SidebarItem
                  to={`/groups/${flag}/edit/roles`}
                  icon={<BadgeIcon className="h-6 w-6" />}
                  state={{ backgroundLocation: state.backgroundLocation }}
                >
                  Roles
                </SidebarItem>
                <SidebarItem
                  to={`/groups/${flag}/edit/delete`}
                  icon={<XIcon className="m-0.5 h-5 w-5" />}
                  state={{ backgroundLocation: state.backgroundLocation }}
                >
                  Delete Group
                </SidebarItem>
              </nav>
              {host !== window.our && (
                <div className="rounded-lg bg-gray-50 p-2 pl-3 text-sm">
                  <ShipConnection ship={host} status={data?.status} />
                </div>
              )}
            </aside>
            <main
              className={cn(
                'order-1 h-full w-full overflow-auto bg-gray-50 sm:order-2',
                isMobile ? 'p-3' : 'p-6'
              )}
            >
              <Outlet />
            </main>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
