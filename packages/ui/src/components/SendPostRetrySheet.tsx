import * as db from '@tloncorp/shared/dist/db';
import { useMemo } from 'react';

import { Action, SimpleActionSheet } from './ActionSheet';

export const SendPostRetrySheet = ({
  open,
  post,
  onOpenChange,
  onPressRetry,
  onPressDelete,
}: {
  open: boolean;
  post: db.Post;
  onOpenChange: (isOpen: boolean) => void;
  onPressRetry: () => void;
  onPressDelete: () => void;
}) => {
  const actionTitle =
    post.editStatus === 'failed'
      ? 'Post edit failed'
      : post.deleteStatus === 'failed'
        ? 'Post delete failed'
        : 'Post failed to send';

  const actions: Action[] = useMemo(
    () => [
      {
        title: 'Retry',
        action: onPressRetry,
      },
      {
        title: 'Delete',
        action: onPressDelete,
        accent: 'negative',
      },
    ],
    [onPressRetry, onPressDelete]
  );
  return (
    <SimpleActionSheet
      title={actionTitle}
      open={open}
      onOpenChange={onOpenChange}
      actions={actions}
    />
  );
};
