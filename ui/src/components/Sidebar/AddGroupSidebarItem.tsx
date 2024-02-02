import { useState } from 'react';
import cn from 'classnames';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { useLocation, useNavigate } from 'react-router-dom';
import AddIcon16 from '../icons/Add16Icon';
import HomeIconMobileNav from '../icons/HomeIconMobileNav';
import SidebarItem from './SidebarItem';
import useActiveTab from './util';

export default function AddGroupSidebarItem() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = useActiveTab();
  const [open, setOpen] = useState(false);

  const onOpenChange = (openChange: boolean) => {
    setOpen(openChange);
  };

  const navigateToModal = (path: string) => {
    navigate(path, { state: { backgroundLocation: location } });
  };

  return (
    <Dropdown.Root open={open} onOpenChange={onOpenChange}>
      <SidebarItem
        className="group"
        icon={
          <HomeIconMobileNav
            className={cn(
              'm-1 h-4 w-4',
              activeTab === 'groups' && 'text-black'
            )}
            asIcon
            isInactive={activeTab !== 'groups'}
          />
        }
        to="/"
        override
        defaultRoute
        color={activeTab === 'groups' ? 'text-black' : 'text-gray-600'}
        actions={
          <Dropdown.Trigger>
            <AddIcon16 className="relative top-[2px] hidden h-4 w-4 group-hover:block" />
          </Dropdown.Trigger>
        }
      >
        <span data-testid="add-group-sidebar-button">Groups</span>
      </SidebarItem>

      <Dropdown.Content
        className="dropdown w-[200px]"
        align="end"
        alignOffset={-80}
        onFocusOutside={() => onOpenChange(false)}
      >
        <Dropdown.Item
          className="dropdown-item default-focus"
          data-testid="join-group-dropdown-button"
          onClick={() => navigateToModal('/add-group/join')}
        >
          Join a Group
        </Dropdown.Item>
        <Dropdown.Item
          className="dropdown-item default-focus"
          data-testid="create-group-dropdown-button"
          onClick={() => navigateToModal('/add-group/create')}
        >
          Create a new Group
        </Dropdown.Item>
      </Dropdown.Content>
    </Dropdown.Root>
  );
}
