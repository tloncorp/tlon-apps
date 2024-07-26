import type * as db from '@tloncorp/shared/dist/db';
import { useMemberRoles } from '@tloncorp/shared/dist/store';
import { useMemo } from 'react';

import type { IconType } from '../components/Icon';
import { useCalm } from '../contexts/calm';

export function useChannelMemberName(member: db.ChatMember) {
  const { disableNicknames } = useCalm();
  if (disableNicknames) {
    return member.contactId;
  }
  return member.contact?.nickname ? member.contact.nickname : member.contactId;
}

export function getChannelTitle(channel: db.Channel) {
  const getChannelMemberName = useChannelMemberName;

  if (channel.type === 'dm') {
    const member = channel.members?.[0];
    if (!member) {
      return channel.id;
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
    case 'picto':
      return 'Draw';
    default:
      return 'ChannelTalk';
  }
}

export function isMuted(model: db.Group | db.Channel) {
  return model.volumeSettings?.isMuted ?? false;
}
