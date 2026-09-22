import type * as db from '@tloncorp/shared/db';
import type { IconType } from '@tloncorp/ui';

import { getChannelTypeIcon } from '../ui/utils/channelTypes';

/**
 * The glyph a channel row leads with.
 *
 * A conversation with people is a figure — one of them for a direct message,
 * two for a group DM — and everything else takes the glyph the app already
 * uses for that kind of channel, so a notebook looks the same here as it does
 * in the workspace's own channel list.
 *
 * `getChannelTypeIcon` is not asked about the two message types: it answers
 * `Face` for both, which reads as an expression rather than as a person and
 * cannot tell one correspondent from several.
 */
export function getDrawerChannelIcon(channel: db.Channel): IconType {
  switch (channel.type) {
    case 'dm':
      return 'ChannelDM';
    case 'groupDm':
      return 'ChannelMultiDM';
    default:
      return getChannelTypeIcon(channel.type);
  }
}

/**
 * The glyph a chat row leads with: `#` for a workspace, and for anything that
 * stands at the top level as a single channel — a direct message, or a channel
 * pinned out of a group — that channel's own.
 */
export function getDrawerChatIcon(chat: db.Chat): IconType {
  return chat.type === 'group' ? 'Channel' : getDrawerChannelIcon(chat.channel);
}
