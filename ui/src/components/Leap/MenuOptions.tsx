import React from 'react';
import TalkIcon from '../icons/TalkIcon';
import ArrowEIcon16 from '../icons/ArrowEIcon16';
import AppGroupsIcon from '../icons/AppGroupsIcon';
import AddIcon16 from '../icons/Add16Icon';

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
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  to: string;
}

export const groupsMenuOptions: IMenuOption[] = [
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
    icon: PlusBadge,
  },
  {
    title: 'Profile',
    subtitle: '',
    to: '/profile/edit',
    icon: CommandBadge,
  },
  {
    title: 'Talk',
    subtitle: '',
    to: '/',
    icon: TalkIcon,
  },
];

export const talkMenuOptions: IMenuOption[] = [
  {
    title: 'New Message',
    subtitle: '',
    to: '/dm/new',
    icon: PlusBadge,
  },
  {
    title: 'Profile',
    subtitle: '',
    to: '/profile/edit',
    icon: CommandBadge,
  },
  {
    title: 'Groups',
    subtitle: '',
    to: '/',
    icon: AppGroupsIcon,
  },
];
