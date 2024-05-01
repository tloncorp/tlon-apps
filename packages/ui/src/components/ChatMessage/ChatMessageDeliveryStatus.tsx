import * as db from '@tloncorp/shared/dist/db';

import { SizableText } from '../../core';

export function ChatMessageDeliveryStatus({
  status,
}: {
  status: db.PostDeliveryStatus;
}) {
  const statusDisplay = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <SizableText
      color={status === 'failed' ? '$negativeActionText' : '$primaryText'}
    >
      {statusDisplay}
    </SizableText>
  );
}
