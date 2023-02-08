import React from 'react';
import TalkIcon from '../icons/TalkIcon';
import ArrowEIcon16 from '../icons/ArrowEIcon16';

function CommandBadge() {
  return (
    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gray-200 p-1 text-white">
      <ArrowEIcon16 />
    </div>
  );
}

export interface IMenuOption {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  to: string;
}

// TODO: filter the options based on the app; e.g., doesn't make sense to
// show Find Groups in Talk... or should it open Groups?
// Also, what if user doesn't have Talk or Groups installed?
const menuOptions: IMenuOption[] = [
  {
    title: 'Profile',
    subtitle: '',
    to: '/profile/edit',
    icon: CommandBadge,
  },
  {
    title: 'Notifications',
    subtitle: '',
    to: '/',
    icon: CommandBadge,
  },

  {
    title: 'Find Groups',
    subtitle: '',
    to: '/find',
    icon: CommandBadge,
  },
  {
    title: 'Create New Group',
    subtitle: '',
    to: '/groups/new',
    icon: CommandBadge,
  },
  {
    title: 'Talk',
    subtitle: '',
    to: '/', // TODO: In Groups, this should open Talk; in Talk, this should go to root? Or should it not be shown at all?
    icon: TalkIcon,
  },
];

export default menuOptions;
