import { configurationFromChannel } from '@tloncorp/shared';
import type * as db from '@tloncorp/shared/db';
import { useMemberRoles } from '@tloncorp/shared/store';
import type { IconType } from '@tloncorp/ui';
import { useMemo } from 'react';

import { useCalm } from '../contexts/appDataContext';
import { formatUserId } from './user';

export function getChannelMemberName(
  member: db.ChatMember,
  disableNicknames: boolean
) {
  if (disableNicknames) {
    return formatUserId(member.contactId)?.display;
  }
  return member.contact?.nickname
    ? member.contact.nickname
    : formatUserId(member.contactId)?.display;
}

export function useChannelMemberName(member: db.ChatMember) {
  const { disableNicknames } = useCalm();
  return getChannelMemberName(member, disableNicknames);
}

export function getChannelTitle({
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

export function useChatTitle(
  channel?: db.Channel | null,
  group?: db.Group | null
) {
  const { disableNicknames } = useCalm();

  if (group && (!channel || group?.channels?.length === 1)) {
    return getGroupTitle(group, disableNicknames);
  } else if (channel) {
    return getChannelTitle({
      ...configurationFromChannel(channel),
      channelTitle: channel.title,
      members: channel.members,
      disableNicknames,
    });
  }

  return null;
}

export function useChannelTitle(channel: db.Channel | null) {
  const { disableNicknames } = useCalm();
  return useMemo(() => {
    if (channel === null) {
      return null;
    }
    return getChannelTitle({
      ...configurationFromChannel(channel),
      channelTitle: channel.title,
      members: channel.members,
      disableNicknames,
    });
  }, [channel, disableNicknames]);
}

export function getGroupTitle(
  group: db.Group,
  disableNicknames: boolean
): string {
  const isPending = group.currentUserIsMember === false;

  if (group?.title && group?.title !== '') {
    return group.title;
  } else if ((group?.members?.length ?? 0) > 1) {
    return (
      group.members
        ?.map((member) => getChannelMemberName(member, disableNicknames))
        .sort((a, b) => (a && b ? a.localeCompare(b) : 0))
        .join(', ') ?? 'No title'
    );
  } else if (isPending) {
    if (group?.members?.length === 1) {
      return `New group by ${getChannelMemberName(group?.members[0], disableNicknames)}`;
    } else {
      return 'New group';
    }
  } else {
    return 'Untitled group';
  }
}

export function useGroupTitle(
  group?: db.Group | null,
  hostContact?: db.Contact | null
) {
  const modelWithHost = useMemo(() => {
    if (!group) {
      return null;
    }
    if (
      hostContact &&
      group.haveInvite === true &&
      group.currentUserIsMember === false
    ) {
      return {
        ...group,
        members: [
          {
            contact: hostContact,
            contactId: hostContact.id,
            membershipType: 'group',
          } as const,
        ],
      };
    }
    return group;
  }, [hostContact, group]);

  const { disableNicknames } = useCalm();
  if (!group || !modelWithHost) {
    return null;
  }
  return getGroupTitle(modelWithHost, disableNicknames);
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

export function useCanWrite(
  channel: db.Channel | null | undefined,
  userId: string
): boolean {
  const writers = useMemo(
    () => channel?.writerRoles?.map((role) => role.roleId) ?? [],
    [channel?.writerRoles]
  );
  const memberRoles = useMemberRoles(channel?.groupId ?? '', userId);
  const canWrite = useMemo(
    () =>
      writers.length === 0 ||
      memberRoles.some((role) => writers.includes(role)),
    [writers, memberRoles]
  );
  return canWrite;
}

export function useCanRead(channel: db.Channel, userId: string): boolean {
  const readers = useMemo(
    () => channel.readerRoles?.map((role) => role.roleId) ?? [],
    [channel.readerRoles]
  );
  const memberRoles = useMemberRoles(channel.groupId ?? '', userId);
  const canRead = useMemo(
    () =>
      readers.length === 0 ||
      memberRoles.some((role) => readers.includes(role)),
    [readers, memberRoles]
  );
  return canRead;
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

export function hasNickname(contact: db.Contact | null | undefined): boolean {
  return 'nickname' in (contact ?? {}) && (contact?.nickname?.length ?? 0) > 0;
}
