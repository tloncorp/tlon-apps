import type * as db from '@tloncorp/shared/dist/db';
import { useMemberRoles } from '@tloncorp/shared/dist/store';
import { useMemo } from 'react';

import type { IconType } from '../components/Icon';
import { useCalm } from '../contexts/calm';

export function getChannelMemberName(
  member: db.ChatMember,
  disableNicknames: boolean
) {
  if (disableNicknames) {
    return member.contactId;
  }
  return member.contact?.nickname ? member.contact.nickname : member.contactId;
}

export function useChannelMemberName(member: db.ChatMember) {
  const { disableNicknames } = useCalm();
  return getChannelMemberName(member, disableNicknames);
}

export function getChannelTitle(
  channel: db.Channel,
  disableNicknames: boolean
) {
  if (channel.type === 'dm') {
    const member = channel.members?.[0];
    if (!member) {
      return channel.id;
    }
    return getChannelMemberName(member, disableNicknames);
  } else if (channel.type === 'groupDm') {
    return channel.title
      ? channel.title
      : channel.members
          ?.map((member) => getChannelMemberName(member, disableNicknames))
          .join(', ') ?? 'No title';
  } else {
    return channel.title ?? 'Untitled channel';
  }
}

export function useChannelTitle(channel: db.Channel) {
  const { disableNicknames } = useCalm();
  return getChannelTitle(channel, disableNicknames);
}

export function isDmChannel(channel: db.Channel): boolean {
  return channel.type !== 'dm' && channel.type !== 'groupDm';
}

export function isGroupChannel(channel: db.Channel): boolean {
  return !isDmChannel(channel);
}

export function useIsAdmin(chatId: string, userId: string): boolean {
  const memberRoles = useMemberRoles(chatId, userId);
  const isAdmin = useMemo(() => memberRoles.includes('admin'), [memberRoles]);
  return isAdmin;
}

export function useCanWrite(channel: db.Channel, userId: string): boolean {
  const writers = useMemo(
    () => channel.writerRoles?.map((role) => role.roleId) ?? [],
    [channel.writerRoles]
  );
  const memberRoles = useMemberRoles(channel.groupId ?? '', userId);
  const canWrite = useMemo(
    () =>
      writers.length === 0 ||
      memberRoles.some((role) => writers.includes(role)),
    [writers, memberRoles]
  );
  return canWrite;
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

export function isMuted(model: db.Group | db.Channel) {
  return model.volumeSettings?.isMuted ?? false;
}
