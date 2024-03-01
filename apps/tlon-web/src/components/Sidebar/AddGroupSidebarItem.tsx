import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import AddIcon16 from '../icons/Add16Icon';
import SidebarItem from './SidebarItem';

export default function GroupSidebarItem() {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const onOpenChange = (openChange: boolean) => {
    setOpen(openChange);
  };

  const navigateToModal = (path: string) => {
    navigate(path, { state: { backgroundLocation: location } });
  };

  const onClick = () => {
    setOpen(true);
  };

  return (
    <Dropdown.Root open={open} onOpenChange={onOpenChange}>
      <SidebarItem
        className="group relative mx-2 mt-2 bg-blue text-white"
        onClick={onClick}
        data-testid="add-group-sidebar-button-icon"
        actions={<Dropdown.Trigger />}
        icon={<AddIcon16 className="m-1 h-4 w-4" />}
      >
        <span className="text-white" data-testid="add-group-sidebar-button">
          New Group
        </span>
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
