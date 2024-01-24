import { useState } from 'react';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { useLocation, useNavigate } from 'react-router-dom';
import AddIcon16 from '../icons/Add16Icon';
import HomeIconMobileNav from '../icons/HomeIconMobileNav';
import SidebarItem from './SidebarItem';

export default function AddGroupSidebarItem() {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const onOpenChange = (openChange: boolean) => {
    setOpen(openChange);
  };

  const navigateToModal = (path: string) => {
    navigate(path, { state: { backgroundLocation: location } });
  };

  return (
    <Dropdown.Root open={open} onOpenChange={onOpenChange}>
      <Dropdown.Trigger>
        <SidebarItem
          icon={<HomeIconMobileNav className="m-1 h-4 w-4" />}
          actions={<AddIcon16 className="h-4 w-4" />}
        >
          <span data-testid="add-group-sidebar-button">Groups</span>
        </SidebarItem>
      </Dropdown.Trigger>

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
