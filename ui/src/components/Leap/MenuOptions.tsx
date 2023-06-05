import React from 'react';
import { isTalk } from '@/logic/utils';
import TalkIcon from '../icons/TalkIcon';
import ArrowEIcon16 from '../icons/ArrowEIcon16';
import AppGroupsIcon from '../icons/AppGroupsIcon';
import AddIcon16 from '../icons/Add16Icon';
import GridIcon from '../icons/GridIcon';

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
  modal: boolean;
}

export const groupsMenuOptions: IMenuOption[] = [
  {
    title: 'Apps',
    subtitle: '',
    to: '/grid',
    icon: GridIcon,
    modal: true,
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
    title: `${isTalk ? 'Talk' : 'Groups'} Settings`,
    subtitle: '',
    to: '/settings',
    icon: CommandBadge,
    modal: true,
  },
  {
    title: 'Talk',
    subtitle: '',
    to: '/',
    icon: TalkIcon,
    modal: false,
  },
];

export const talkMenuOptions: IMenuOption[] = [
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
    title: 'Profile',
    subtitle: '',
    to: '/profile/edit',
    icon: CommandBadge,
    modal: false,
  },
  {
    title: 'Groups',
    subtitle: '',
    to: '/',
    icon: AppGroupsIcon,
    modal: false,
  },
];
