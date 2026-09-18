import { describe, expect, it } from 'vitest';

import { isDrawerDestinationRoute } from './drawerDestination';

describe('isDrawerDestinationRoute', () => {
  it('claims every direct message, however it was reached', () => {
    expect(isDrawerDestinationRoute({ name: 'DM', params: {} })).toBe(true);
    expect(isDrawerDestinationRoute({ name: 'GroupDM', params: {} })).toBe(
      true
    );
  });

  it('claims the single channel a one-channel group is entered through', () => {
    expect(
      isDrawerDestinationRoute({
        name: 'Channel',
        params: { channelId: 'c', groupId: 'g', isOnlyChannel: true },
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
        params: { channelId: 'c', groupId: 'g', isOnlyChannel: false },
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
