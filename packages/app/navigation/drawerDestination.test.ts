import { describe, expect, it } from 'vitest';

import { isDrawerDestinationRoute, routeShowsChat } from './drawerDestination';

describe('isDrawerDestinationRoute', () => {
  it('claims every direct message, however it was reached', () => {
    expect(isDrawerDestinationRoute({ name: 'DM', params: {} })).toBe(true);
    expect(isDrawerDestinationRoute({ name: 'GroupDM', params: {} })).toBe(
      true
    );
  });

  it('claims a channel that was opened as a destination in its own right', () => {
    // A one-channel group's only channel, and a channel picked out of the
    // drawer, both arrive stamped.
    expect(
      isDrawerDestinationRoute({
        name: 'Channel',
        params: { channelId: 'c', groupId: 'g', isDrawerDestination: true },
      })
    ).toBe(true);
  });

  it('leaves an ordinary group channel its back caret', () => {
    expect(
      isDrawerDestinationRoute({
        name: 'Channel',
        params: { channelId: 'c', groupId: 'g' },
      })
    ).toBe(false);
    expect(
      isDrawerDestinationRoute({
        name: 'Channel',
        params: { channelId: 'c', groupId: 'g', isDrawerDestination: false },
      })
    ).toBe(false);
  });

  it("claims a group's channel list, which is how a group is opened", () => {
    expect(
      isDrawerDestinationRoute({
        name: 'GroupChannels',
        params: { groupId: 'g' },
      })
    ).toBe(true);
  });

  it('is false for a screen pushed over one of those', () => {
    expect(isDrawerDestinationRoute({ name: 'MainTabs' })).toBe(false);
    expect(isDrawerDestinationRoute({ name: 'UserProfile' })).toBe(false);
    expect(isDrawerDestinationRoute({ name: 'ChannelSearch' })).toBe(false);
    expect(isDrawerDestinationRoute(undefined)).toBe(false);
  });
});

describe('routeShowsChat', () => {
  const dm = { type: 'channel' as const, channel: { id: '~dm' } };
  const oneChannelGroup = {
    type: 'group' as const,
    group: { id: 'g1', channels: [{ id: 'c1' }] },
  };
  const manyChannelGroup = {
    type: 'group' as const,
    group: { id: 'g2', channels: [{ id: 'c2' }, { id: 'c3' }] },
  };

  it('matches a direct message by its channel', () => {
    expect(
      routeShowsChat(dm, { name: 'DM', params: { channelId: '~dm' } })
    ).toBe(true);
    expect(
      routeShowsChat(dm, { name: 'DM', params: { channelId: '~other' } })
    ).toBe(false);
  });

  it('matches a group by its channel list', () => {
    expect(
      routeShowsChat(manyChannelGroup, {
        name: 'GroupChannels',
        params: { groupId: 'g2' },
      })
    ).toBe(true);
  });

  it('matches a one-channel group by the channel it opens', () => {
    expect(
      routeShowsChat(oneChannelGroup, {
        name: 'Channel',
        params: { channelId: 'c1', groupId: 'g1' },
      })
    ).toBe(true);
  });

  // The pair that shares a groupId: a group and a channel pinned out of it are
  // two rows, and neither may answer for the other.
  it('does not let a pinned channel stand for its group', () => {
    expect(
      routeShowsChat(manyChannelGroup, {
        name: 'Channel',
        params: { channelId: 'c3', groupId: 'g2' },
      })
    ).toBe(false);
    expect(
      routeShowsChat(
        { type: 'channel', channel: { id: 'c3' } },
        { name: 'GroupChannels', params: { groupId: 'g2' } }
      )
    ).toBe(false);
  });
});
