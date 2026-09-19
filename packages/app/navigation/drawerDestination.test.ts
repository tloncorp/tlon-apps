import { describe, expect, it } from 'vitest';

import {
  carriedConversationParams,
  drawerOwnsEdge,
  isDrawerDestinationRoute,
  routeShowsChat,
} from './drawerDestination';

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

describe('drawerOwnsEdge', () => {
  const stack = (...names: string[]) => ({
    index: names.length - 1,
    routes: names.map((name, i) => ({ name, key: `${name}-${i}`, params: {} })),
  });

  it('takes the edge on a conversation sitting on the sections', () => {
    for (const name of ['DM', 'GroupDM', 'GroupChannels']) {
      expect(drawerOwnsEdge(stack('MainTabs', name))).toBe(true);
    }
  });

  // The case this exists for: these same screens are also pushed over a
  // conversation, and there the screen underneath is the way back.
  it('leaves the edge to the back gesture on one pushed over another screen', () => {
    expect(drawerOwnsEdge(stack('MainTabs', 'Channel', 'DM'))).toBe(false);
    expect(drawerOwnsEdge(stack('MainTabs', 'DM', 'GroupDM'))).toBe(false);
    expect(drawerOwnsEdge(stack('MainTabs', 'Post', 'GroupChannels'))).toBe(
      false
    );
  });

  // Deliberately not asking how the conversation was reached. One opened from
  // a link inside a tab gives up its back gesture too; the panel has a row for
  // every section, and the alternative is a conversation opened from the
  // workspace list swiping back to the workspace list.
  it('does not ask how the conversation was reached', () => {
    expect(drawerOwnsEdge(stack('MainTabs', 'GroupChannels'))).toBe(true);
  });

  it('never takes the edge on the sections themselves', () => {
    expect(drawerOwnsEdge(stack('MainTabs'))).toBe(false);
  });

  it('is false for a route that is not a destination at all', () => {
    expect(drawerOwnsEdge(stack('MainTabs', 'Post'))).toBe(false);
    expect(
      drawerOwnsEdge({
        index: 1,
        routes: [
          { name: 'MainTabs', key: 'MainTabs-0' },
          { name: 'Channel', key: 'Channel-1', params: {} },
        ],
      })
    ).toBe(false);
  });

  it('claims a channel opened as a destination, not one merely pushed', () => {
    const marked = {
      name: 'Channel',
      key: 'Channel-1',
      params: { isDrawerDestination: true },
    };
    expect(
      drawerOwnsEdge({
        index: 1,
        routes: [{ name: 'MainTabs', key: 'MainTabs-0' }, marked],
      })
    ).toBe(true);
    expect(
      drawerOwnsEdge({
        index: 2,
        routes: [
          { name: 'MainTabs', key: 'MainTabs-0' },
          { name: 'Channel', key: 'Channel-1', params: {} },
          { ...marked, key: 'Channel-2' },
        ],
      })
    ).toBe(false);
  });

  // Each screen asks about itself, since every one of them is mounted at once
  // and only the focused one is on top.
  it('answers for the route named, not for whichever is focused', () => {
    const state = stack('MainTabs', 'DM', 'UserProfile');
    expect(drawerOwnsEdge(state, 'DM-1')).toBe(true);
    expect(drawerOwnsEdge(state, 'UserProfile-2')).toBe(false);
    expect(drawerOwnsEdge(state)).toBe(false);
  });

  it('is false for a key the stack does not hold, and for no stack', () => {
    expect(drawerOwnsEdge(stack('MainTabs', 'DM'), 'gone')).toBe(false);
    expect(drawerOwnsEdge(undefined)).toBe(false);
    expect(drawerOwnsEdge({ index: 0, routes: [] })).toBe(false);
  });
});

// `popTo` overwrites the params of the route it lands on, so returning from a
// post has to put these back. A second marker was once added elsewhere and
// dropped here, which is why the carrying is one function with one test.
describe('carriedConversationParams', () => {
  it('carries every marker a conversation route was holding', () => {
    expect(
      carriedConversationParams({
        channelId: 'c',
        isDrawerDestination: true,
      })
    ).toEqual({ isDrawerDestination: true });
  });

  // Absent rather than false, so a spread of this leaves the params clean.
  it('carries nothing when the route held nothing', () => {
    expect(carriedConversationParams({ channelId: 'c' })).toEqual({});
    expect(carriedConversationParams(undefined)).toEqual({});
    expect(carriedConversationParams({ isDrawerDestination: false })).toEqual(
      {}
    );
  });
});
