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

export type DrawerChatLeading =
  | { kind: 'glyph'; icon: IconType }
  | { kind: 'image'; imageUrl: string; fallback: IconType }
  | { kind: 'contact'; contactId: string };

/**
 * What a chat row leads with, in the glyph's column.
 *
 * - A row of the pinned section: a pin, whatever it is, since that section is
 *   the one place where why a row sits where it does is not its recency.
 * - A workspace: its icon when it has one, and `#` when it has none — or while
 *   the icon cannot be shown, which is what `fallback` is for.
 * - A direct message: the person, by their avatar or else their sigil.
 * - Anything else standing at the top level as a single channel — a group DM,
 *   or a channel pinned out of a group — that channel's own glyph.
 */
export function getDrawerChatLeading(
  chat: db.Chat,
  pinned: boolean
): DrawerChatLeading {
  if (pinned) {
    return { kind: 'glyph', icon: 'Pin' };
  }
  if (chat.type === 'group') {
    return chat.group.iconImage
      ? { kind: 'image', imageUrl: chat.group.iconImage, fallback: 'Channel' }
      : { kind: 'glyph', icon: 'Channel' };
  }
  if (chat.channel.type === 'dm') {
    // How `ChannelAvatar` finds a direct message's correspondent.
    return {
      kind: 'contact',
      contactId: chat.channel.members?.[0]?.contactId ?? chat.channel.id,
    };
  }
  return { kind: 'glyph', icon: getDrawerChannelIcon(chat.channel) };
}
