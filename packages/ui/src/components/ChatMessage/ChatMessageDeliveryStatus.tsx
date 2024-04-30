import * as db from '@tloncorp/shared/dist/db';

import { Text, View } from '../../core';

export function ChatMessageDeliveryStatus({
  status,
}: {
  status: db.PostDeliveryStatus;
}) {
  return <Text>{status}</Text>;
}
