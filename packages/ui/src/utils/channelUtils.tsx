import type * as db from '@tloncorp/shared/dist/db';

import type { IconType } from '../components/Icon';

export function getChannelTitle(channel: db.ChannelWithLastPostAndMembers) {
  if (channel.type === 'dm') {
    const member = channel.members?.[0];
    if (!member) {
      console.warn('bad dm channel', channel.id, 'missing contact');
      return 'Untitled DM';
    }
    return getChannelMemberName(member);
  } else if (channel.type === 'groupDm') {
    return channel.title
      ? channel.title
      : channel.members?.map(getChannelMemberName).join(', ') ?? 'No title';
  } else {
    return channel.title ?? 'Untitled channel';
  }
}

export function getChannelMemberName(
  member: db.ChannelMember & { contact: db.Contact | null }
) {
  return member.contact?.nickname ? member.contact.nickname : member.contactId;
}

export function getChannelTypeIcon(type: db.Channel['type']): IconType {
  switch (type) {
    case 'dm':
      return 'Face';
    case 'groupDm':
      return 'Face';
    case 'chat':
      return 'ChannelTalk';
    case 'notebook':
      return 'ChannelNotebooks';
    case 'gallery':
      return 'ChannelGalleries';
    default:
      return 'ChannelTalk';
  }
}
