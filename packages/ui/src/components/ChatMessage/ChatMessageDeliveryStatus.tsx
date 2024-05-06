import * as db from '@tloncorp/shared/dist/db';

import { SizableText } from '../../core';

export function ChatMessageDeliveryStatus({
  status,
}: {
  status: db.PostDeliveryStatus;
}) {
  const statusDisplay =
    status === 'failed'
      ? 'Failed'
      : status === 'pending'
        ? 'Pending...'
        : 'Sent...';
  return (
    <SizableText
      color={status === 'failed' ? '$negativeActionText' : '$secondaryText'}
    >
      {statusDisplay}
    </SizableText>
  );
}
