import type * as db from '@tloncorp/shared/dist/db';

import { ActionSheet } from './ActionSheet';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel?: db.Channel;
}

const actions = [
  {
    title: 'Connected',
    variant: 'success',
    action: () => {},
  },
  {
    title: 'Invite People',
    variant: 'primary',
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
    <ActionSheet open={open} onOpenChange={onOpenChange}>
      <ActionSheet.Header>
        <ActionSheet.Title>
          {channel?.title ?? 'Group Options'}
        </ActionSheet.Title>
        <ActionSheet.Description>Quick actions</ActionSheet.Description>
      </ActionSheet.Header>
      {actions.map((action, index) => (
        <ActionSheet.Action
          key={index}
          action={action.action}
          primary={action.variant === 'primary'}
          success={action.variant === 'success'}
          destructive={action.variant === 'destructive'}
        >
          <ActionSheet.ActionTitle>{action.title}</ActionSheet.ActionTitle>
          {action.description && (
            <ActionSheet.ActionDescription>
              {action.description}
            </ActionSheet.ActionDescription>
          )}
        </ActionSheet.Action>
      ))}
    </ActionSheet>
  );
}
