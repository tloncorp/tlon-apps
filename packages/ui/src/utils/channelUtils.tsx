import { usePostCollectionConfigurationFromChannelType } from '@tloncorp/shared';
import type * as db from '@tloncorp/shared/dist/db';
import { useMemberRoles } from '@tloncorp/shared/dist/store';
import { useMemo } from 'react';

import type { IconType } from '../components/Icon';
import { useCalm } from '../contexts';

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

function getChannelTitle({
  usesMemberListAsFallbackTitle,
  channelTitle,
  members,
  disableNicknames,
}: {
  usesMemberListAsFallbackTitle: boolean;
  channelTitle?: string | null;
  members?: db.ChatMember[] | null;
  disableNicknames: boolean;
}) {
  if (usesMemberListAsFallbackTitle) {
    // NB: This has the potential to use a DM's given title if it has one.
    // (There should be no path to titling a 1:1 DM in-app.)
    return channelTitle
      ? channelTitle
      : members
          ?.map((member) => getChannelMemberName(member, disableNicknames))
          .join(', ') ?? 'No title';
  } else {
    return channelTitle ?? 'Untitled channel';
  }
}

export function useChannelTitle(channel: db.Channel | null) {
  const { disableNicknames } = useCalm();
  const usesMemberListAsFallbackTitle =
    usePostCollectionConfigurationFromChannelType(
      channel?.type ?? null
    )?.usesMemberListAsFallbackTitle;

  return useMemo(
    () =>
      channel == null || usesMemberListAsFallbackTitle == null
        ? null
        : getChannelTitle({
            usesMemberListAsFallbackTitle,
            channelTitle: channel.title,
            members: channel.members,
            disableNicknames,
          }),
    [channel, disableNicknames, usesMemberListAsFallbackTitle]
  );
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
