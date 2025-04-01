import { configurationFromChannel } from '@tloncorp/shared';
import type * as db from '@tloncorp/shared/db';
import type {
  GroupChannel,
  Group as UrbitGroup,
} from '@tloncorp/shared/urbit/groups';

import { useCalm } from '@/state/settings';

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
    return channelTitle
      ? channelTitle
      : members
          ?.map((member) => getChannelMemberName(member, disableNicknames))
          .join(', ') ?? 'Untitled channel';
  } else {
    return channelTitle ?? 'Untitled channel';
  }
}

export function getChannelMemberName(
  member: db.ChatMember,
  disableNicknames: boolean
) {
  if (disableNicknames) {
    return member.contactId;
  }
  return member.contact?.nickname ? member.contact.nickname : member.contactId;
}

export function getGroupTitle(
  group: db.Group,
  disableNicknames: boolean
): string {
  if (group?.title && group?.title !== '') {
    return group.title;
  } else if ((group?.members?.length ?? 0) > 1) {
    return (
      group.members
        ?.map((member) => getChannelMemberName(member, disableNicknames))
        .join(', ') ?? 'Untitled group'
    );
  } else {
    return 'Untitled group';
  }
}

export function useChatTitle(
  channel?: db.Channel | GroupChannel | null,
  group?: db.Group | UrbitGroup | null
) {
  const { disableNicknames } = useCalm();

  if (
    group &&
    (!channel || ('channels' in group && group.channels?.length === 1))
  ) {
    return getGroupTitle(group as db.Group, disableNicknames);
  } else if (channel) {
    if ('meta' in channel) {
      return channel.meta.title;
    } else {
      return getChannelTitle({
        ...configurationFromChannel(channel),
        channelTitle: channel.title,
        members: channel.members,
        disableNicknames,
      });
    }
  }

  return null;
}
