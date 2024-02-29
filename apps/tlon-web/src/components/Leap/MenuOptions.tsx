import Avatar from '../Avatar';
import AddIcon16 from '../icons/Add16Icon';
import ArrowEIcon16 from '../icons/ArrowEIcon16';
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
  icon: React.ReactElement | ((props: IconProps) => React.ReactElement);
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
    title: 'Create a new Group',
    subtitle: '',
    to: '/add-group/create',
    icon: PlusBadge,
    modal: true,
  },
  {
    title: 'Join a Group',
    subtitle: '',
    to: '/add-group/join',
    icon: PlusBadge,
    modal: true,
  },
  {
    title: 'Profile & Settings',
    subtitle: '',
    to: '/profile',
    icon: <Avatar ship={window.our} size="xs" />,
    modal: false,
  },
];
