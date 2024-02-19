import React, { useContext } from 'react';

import Avatar, { useProfileColor } from '@/components/Avatar';
import ShipName from '@/components/ShipName';
import { ActivitySidebarItem } from '@/components/Sidebar/ActivityIndicator';
import SidebarItem from '@/components/Sidebar/SidebarItem';
import { AppUpdateContext } from '@/logic/useAppUpdates';

import { DesktopUpdateButton } from '../UpdateNotices';
import GroupsSidebarItem from './AddGroupSidebarItem';
import MessagesSidebarItem from './MessagesSidebarItem';
import SidebarHeader from './SidebarHeader';
import useActiveTab from './util';

const UpdateOrAppMenu = React.memo(() => {
  const { needsUpdate } = useContext(AppUpdateContext);
  return needsUpdate ? <DesktopUpdateButton /> : <SidebarHeader />;
});

const SidebarTopMenu = React.memo(() => {
  const shipColor = useProfileColor(window.our);
  const activeTab = useActiveTab();

  return (
    <div className="flex w-full flex-col space-y-0.5 p-2">
      <UpdateOrAppMenu />

      <GroupsSidebarItem />
      <MessagesSidebarItem />
      <ActivitySidebarItem />

      <SidebarItem
        highlight={shipColor}
        icon={<Avatar size="sidebar" className="m-1" ship={window.our} />}
        to={'/profile/edit'}
        color={activeTab === 'profile' ? 'text-black' : 'text-gray-600'}
      >
        <ShipName showAlias name={window.our} />
      </SidebarItem>
    </div>
  );
});

export default SidebarTopMenu;
