import { isChannelId } from '../api/apiUtils';
import * as db from '../db';

export function isChatChannel(channel: db.Channel): boolean {
  return (
    channel.type === 'chat' ||
    channel.type === 'dm' ||
    channel.type === 'groupDm'
  );
}

export function isChannel(obj: db.Channel | db.Group): obj is db.Channel {
  return isChannelId(obj.id);
}

export function isGroup(obj: db.Channel | db.Group): obj is db.Group {
  return !isChannelId(obj.id);
}
