import type * as db from '@tloncorp/shared/db';

export type GroupChannelSection = {
  id: string;
  title: string;
  channels: db.Channel[];
};

/**
 * A group's channels in the order its channel list shows them, under the
 * headings it shows them under: newest first under one heading, or the
 * group's own sections in their arranged order followed by the channels no
 * section holds.
 *
 * Shared by the channel list and the options sheet's channel menu, so the menu
 * follows the sort the sheet's own "Sort channels" sets.
 */
export function getGroupChannelSections(
  group: Pick<db.Group, 'channels' | 'navSections'>,
  sortBy: db.ChannelSortPreference
): GroupChannelSection[] {
  const channels = group.channels ?? [];
  if (channels.length === 0) {
    return [];
  }

  if (sortBy === 'recency') {
    // Whichever is newer of the latest post or the activity summary's
    // recency — non-post activity (e.g. a note in a notebook channel, which
    // never has posts) also counts
    const channelsSortedByRecency = [...channels].sort((a, b) => {
      const aRecency = Math.max(a.lastPostAt ?? 0, a.unread?.updatedAt ?? 0);
      const bRecency = Math.max(b.lastPostAt ?? 0, b.unread?.updatedAt ?? 0);
      return bRecency - aRecency;
    });
    return [
      {
        id: 'recent-channels',
        title: 'Recent Channels',
        channels: channelsSortedByRecency,
      },
    ];
  }

  const sections: GroupChannelSection[] = [];
  group.navSections?.forEach((section) => {
    const sectionChannels = channels.filter((c) =>
      section.channels?.some((sc) => sc.channelId === c.id)
    );
    if (sectionChannels.length === 0) {
      return;
    }
    const indexOf = (channel: db.Channel) =>
      section.channels?.find((c) => c.channelId === channel.id)?.channelIndex ??
      0;
    sections.push({
      id: `section-${section.id}`,
      title: section.title ?? '',
      channels: [...sectionChannels].sort((a, b) => indexOf(a) - indexOf(b)),
    });
  });

  const unGroupedChannels = channels.filter(
    (c) =>
      !group.navSections?.some((s) =>
        s.channels?.some((sc) => sc.channelId === c.id)
      )
  );
  if (unGroupedChannels.length > 0) {
    sections.push({
      id: 'all-channels',
      title: 'All Channels',
      channels: unGroupedChannels,
    });
  }

  return sections;
}

/**
 * The channels the options sheet offers to move to, and what it calls them.
 *
 * A channel's sheet lists the group's other channels. A group's sheet lists
 * all of them, and so does any sheet of a group with a single channel, where
 * that channel is the group: it is the user's way in, not a duplicate of where
 * they already are.
 */
export function getGroupChannelMenu(
  group: Pick<db.Group, 'channels' | 'navSections'>,
  sortBy: db.ChannelSortPreference,
  currentChannelId?: string
): { title: string; channels: db.Channel[] } {
  const channels = getGroupChannelSections(group, sortBy).flatMap(
    (section) => section.channels
  );
  if (
    channels.length !== 1 &&
    channels.some((channel) => channel.id === currentChannelId)
  ) {
    return {
      title: 'Other channels in this workspace',
      channels: channels.filter((channel) => channel.id !== currentChannelId),
    };
  }
  return { title: 'Channels in this workspace', channels };
}
