import * as db from '@tloncorp/shared/dist/db';

export default function getChannelTitle(channel: db.ChannelSummary) {
  if (channel.type === 'dm') {
    const member = channel.members?.[0];
    if (!member) {
      console.warn('bad dm channel', channel.id, 'missing contact');
      return 'Untitled DM';
    }
    return getMemberName(member);
  } else if (channel.type === 'groupDm') {
    return channel.title
      ? channel.title
      : channel.members?.map(getMemberName).join(', ') ?? 'No title';
  } else {
    return channel.title ?? 'Untitled channel';
  }
}

function getMemberName(
  member: db.ChannelMember & { contact: db.Contact | null }
) {
  return member.contact?.nickname ? member.contact.nickname : member.contactId;
}
