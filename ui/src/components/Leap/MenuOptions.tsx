import ArrowEIcon16 from '../icons/ArrowEIcon16';
import AppGroupsIcon from '../icons/AppGroupsIcon';
import AddIcon16 from '../icons/Add16Icon';
import GridIcon from '../icons/GridIcon';
import { IconProps } from '../icons/icon';

function CommandBadge() {
  return (
    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gray-200 p-1 text-white">
      <ArrowEIcon16 />
    </div>
  );
}

function PlusBadge() {
  return (
    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gray-200 p-1 text-white">
      <AddIcon16 />
    </div>
  );
}

export interface IMenuOption {
  icon: (props: IconProps) => JSX.Element;
  title: string;
  subtitle: string;
  to: string;
  modal: boolean;
}

export const menuOptions: IMenuOption[] = [
  {
    title: 'Apps',
    subtitle: '',
    to: '/grid',
    icon: GridIcon,
    modal: true,
  },
  {
    title: 'New Message',
    subtitle: '',
    to: '/dm/new',
    icon: PlusBadge,
    modal: false,
  },
  {
    title: 'Activity',
    subtitle: '',
    to: '/notifications',
    icon: CommandBadge,
    modal: false,
  },
  {
    title: 'Find Groups',
    subtitle: '',
    to: '/find',
    icon: CommandBadge,
    modal: false,
  },
  {
    title: 'Create New Group',
    subtitle: '',
    to: '/groups/new',
    icon: PlusBadge,
    modal: true,
  },
  {
    title: 'Profile',
    subtitle: '',
    to: '/profile/edit',
    icon: CommandBadge,
    modal: false,
  },
  {
    title: 'Tlon Settings',
    subtitle: '',
    to: '/settings',
    icon: CommandBadge,
    modal: true,
  },
  {
    title: 'Tlon',
    subtitle: '',
    to: '/',
    icon: AppGroupsIcon,
    modal: false,
  },
];
