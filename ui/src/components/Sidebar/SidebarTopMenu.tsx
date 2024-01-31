import React, { useContext } from 'react';
import cn from 'classnames';
import { debounce } from 'lodash';
import { Link, useLocation } from 'react-router-dom';
import ActivityIndicator, {
  ActivitySidebarItem,
} from '@/components/Sidebar/ActivityIndicator';
import { useIsMobile } from '@/logic/useMedia';
import SidebarItem from '@/components/Sidebar/SidebarItem';
import { AppUpdateContext } from '@/logic/useAppUpdates';
import ShipName from '@/components/ShipName';
import Avatar, { useProfileColor } from '@/components/Avatar';
import AddGroupSidebarItem from './AddGroupSidebarItem';
import SidebarHeader from './SidebarHeader';
import MessagesIcon from '../icons/MessagesIcon';
import { DesktopUpdateButton } from '../UpdateNotices';
import useActiveTab from './util';
import AddIcon16 from '../icons/Add16Icon';

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

      <AddGroupSidebarItem />

      <SidebarItem
        icon={
          <MessagesIcon
            className={cn(
              'm-1 h-4 w-4',
              activeTab === 'messages' && 'text-gray-700'
            )}
            nonNav
            isInactive={activeTab !== 'messages'}
          />
        }
        actions={
          <Link to="/dm/new" className="hidden group-hover:block">
            <AddIcon16 className="h-4 w-4" />
          </Link>
        }
        to={'/messages'}
        className="group"
      >
        Messages
      </SidebarItem>

      <ActivitySidebarItem />

      <SidebarItem
        highlight={shipColor}
        icon={<Avatar size="xs" ship={window.our} />}
        to={'/profile/edit'}
      >
        <ShipName showAlias name={window.our} />
      </SidebarItem>
    </div>
  );
});

export default SidebarTopMenu;
