import { useMemo } from 'react';

import { Action, SimpleActionSheet } from './ActionSheet';

export function AddChatSheet({
  open,
  onOpenChange,
  onPressNewGroup,
  onPressNewDm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPressNewGroup: () => void;
  onPressNewDm: () => void;
}) {
  const actions: Action[] = useMemo(
    (): Action[] => [
      {
        title: 'New direct message',
        description: 'Create a new chat with one other person.',
        action: onPressNewDm,
      },
      {
        title: 'New group',
        description: 'Create a new group chat or customizable social space',
        action: onPressNewGroup,
      },
    ],
    [onPressNewDm, onPressNewGroup]
  );

  return (
    <SimpleActionSheet
      open={open}
      onOpenChange={onOpenChange}
      actions={actions}
    />
  );
}
