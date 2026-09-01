import type * as db from '@tloncorp/shared/db';

export function canMarkChannelRead(
  channel: Pick<db.Channel, 'id' | 'unread'>
): boolean {
  return channel.unread?.count !== 0;
}
