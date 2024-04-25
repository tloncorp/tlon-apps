import type * as db from '@tloncorp/shared/dist/db';

import ActionSheet, { Action } from './ActionSheet';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel?: db.Channel;
}

const actions: Action[] = [
  {
    title: 'Connected',
    backgroundColor: '$greenSoft',
    borderColor: '$green',
    titleColor: '$green',
    action: () => {},
  },
  {
    title: 'Invite People',
    backgroundColor: '$blueSoft',
    borderColor: '$blue',
    titleColor: '$blue',
    action: () => {},
  },
  {
    title: 'Group settings',
    description: 'Configure group details and privacy',
    action: () => {},
  },
  {
    title: 'Copy group reference',
    description: 'Copy an in-Urbit link to this group',
    action: () => {},
  },
  {
    title: 'Group members',
    description: 'View all members and roles',
    action: () => {},
  },
  {
    title: 'Channels',
    description: 'View all channels you have access to',
    action: () => {},
  },
  {
    title: 'Group notification settings',
    description: 'Configure your notifications for this group',
    action: () => {},
  },
  // TODO: channel pin state
];

export function ChatOptionsSheet({ open, onOpenChange, channel }: Props) {
  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      actions={actions}
      sheetTitle={channel?.title ?? undefined}
      sheetDescription="Quick actions"
    />
  );
}
