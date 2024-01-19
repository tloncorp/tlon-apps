import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { Link, useLocation } from 'react-router-dom';
import AddIcon16 from '../icons/Add16Icon';
import HomeIconMobileNav from '../icons/HomeIconMobileNav';
import SidebarItem from './SidebarItem';

export default function AddGroupSidebarItem() {
  const location = useLocation();
  return (
    <Dropdown.Root>
      <Dropdown.Trigger>
        <SidebarItem
          icon={<HomeIconMobileNav className="m-1 h-4 w-4" />}
          actions={<AddIcon16 className="h-4 w-4" />}
          defaultRoute
        >
          Groups
        </SidebarItem>
      </Dropdown.Trigger>

      <Dropdown.Content
        className="dropdown w-[200px]"
        align="end"
        alignOffset={-80}
      >
        <Dropdown.Item className="dropdown-item">
          <Link to="add-group/join">Join a Group</Link>
        </Dropdown.Item>
        <Dropdown.Item className="dropdown-item">
          <Link to="add-group/create" state={{ backgroundLocation: location }}>
            Create a new Group
          </Link>
        </Dropdown.Item>
      </Dropdown.Content>
    </Dropdown.Root>
  );
}
