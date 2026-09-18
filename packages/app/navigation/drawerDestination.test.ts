import { describe, expect, it } from 'vitest';

import { isDrawerDestinationRoute } from './drawerDestination';

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
