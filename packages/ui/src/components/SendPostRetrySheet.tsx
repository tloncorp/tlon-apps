import { useMemo } from 'react';

import { Action, SimpleActionSheet } from './ActionSheet';

export const SendPostRetrySheet = ({
  open,
  onOpenChange,
  onPressRetry,
  onPressDelete,
}: {
  open: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onPressRetry: () => void;
  onPressDelete: () => void;
}) => {
  const actions: Action[] = useMemo(
    () => [
      {
        title: 'Retry',
        action: onPressRetry,
      },
      {
        title: 'Delete',
        action: onPressDelete,
      },
    ],
    [onPressRetry, onPressDelete]
  );
  return (
    <SimpleActionSheet
      title="Post failed to send"
      open={open}
      onOpenChange={onOpenChange}
      actions={actions}
    />
  );
};
