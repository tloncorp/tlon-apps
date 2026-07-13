import { describe, expect, test } from 'vitest';

import {
  NavigationChainNode,
  getActiveTopLevelDrawerRouteName,
  getDesktopGroupInviteRoute,
  getDesktopPostRoute,
} from './routeHelpers';

// Build a `{ getState, getParent }` chain from innermost -> outermost so we can
// exercise the parent-walk without a live React Navigation object. The first
// state is the active (innermost) navigator; each subsequent one is its parent.
function makeChain(
  states: { type?: string; index: number; routes: { name: string }[] }[]
): NavigationChainNode {
  function nodeAt(i: number): NavigationChainNode | undefined {
    if (i >= states.length) {
      return undefined;
    }
    return {
      getState: () => states[i],
      getParent: () => nodeAt(i + 1),
    };
  }
  return nodeAt(0)!;
}

describe('getActiveTopLevelDrawerRouteName', () => {
  test('returns Activity from inside the nested Activity drawer (default inner route)', () => {
    const chain = makeChain([
      // inner desktop Activity drawer, default inner screen
      {
        type: 'drawer',
        index: 0,
        routes: [{ name: 'ActivityEmpty' }, { name: 'GroupSettings' }],
      },
      // top-level drawer, Activity active
      {
        type: 'drawer',
        index: 2,
        routes: [
          { name: 'Home' },
          { name: 'Messages' },
          { name: 'Activity' },
          { name: 'Contacts' },
          { name: 'Settings' },
        ],
      },
    ]);
    expect(getActiveTopLevelDrawerRouteName(chain)).toBe('Activity');
  });

  test('returns Activity even when inner Activity route is GroupSettings (not the default)', () => {
    const chain = makeChain([
      {
        type: 'drawer',
        index: 1,
        routes: [{ name: 'ActivityEmpty' }, { name: 'GroupSettings' }],
      },
      {
        type: 'drawer',
        index: 2,
        routes: [
          { name: 'Home' },
          { name: 'Messages' },
          { name: 'Activity' },
          { name: 'Contacts' },
          { name: 'Settings' },
        ],
      },
    ]);
    expect(getActiveTopLevelDrawerRouteName(chain)).toBe('Activity');
  });

  test('returns the OUTERMOST top-level name for an in-channel chain (not the inner Channel drawer)', () => {
    const chain = makeChain([
      // innermost channel stack on a Post screen
      {
        type: 'stack',
        index: 1,
        routes: [{ name: 'ChannelRoot' }, { name: 'Post' }],
      },
      // channel drawer (Channel active) — must NOT be treated as top-level
      {
        type: 'drawer',
        index: 0,
        routes: [{ name: 'Channel' }, { name: 'DM' }, { name: 'GroupDM' }],
      },
      // top-level drawer, Home active
      {
        type: 'drawer',
        index: 0,
        routes: [
          { name: 'Home' },
          { name: 'Messages' },
          { name: 'Activity' },
          { name: 'Contacts' },
          { name: 'Settings' },
        ],
      },
    ]);
    expect(getActiveTopLevelDrawerRouteName(chain)).toBe('Home');
  });

  test('recognizes the real Contacts top-level drawer route (not the stale Profile name)', () => {
    const chain = makeChain([
      {
        type: 'drawer',
        index: 3,
        routes: [
          { name: 'Home' },
          { name: 'Messages' },
          { name: 'Activity' },
          { name: 'Contacts' },
          { name: 'Settings' },
        ],
      },
    ]);
    expect(getActiveTopLevelDrawerRouteName(chain)).toBe('Contacts');
  });

  test('returns undefined when no top-level drawer route is active in the chain', () => {
    const chain = makeChain([
      {
        type: 'stack',
        index: 0,
        routes: [{ name: 'Post' }],
      },
    ]);
    expect(getActiveTopLevelDrawerRouteName(chain)).toBeUndefined();
  });
});

describe('getDesktopPostRoute', () => {
  const base = {
    postId: '~author/123.456',
    authorId: '~author',
  };

  test('group channel -> wrapper screen Channel with channelId + groupId', () => {
    const route = getDesktopPostRoute('Home', {
      ...base,
      channelId: 'chat/~group/channel',
      groupId: '~group',
    });
    expect(route.name).toBe('Home');
    expect(route.params.screen).toBe('Channel');
    expect(route.params.params.channelId).toBe('chat/~group/channel');
    expect(route.params.params.groupId).toBe('~group');
    expect(route.params.params.screen).toBe('Post');
    expect(route.params.params.params).toMatchObject({
      ...base,
      channelId: 'chat/~group/channel',
      groupId: '~group',
    });
  });

  test('DM channel -> wrapper screen DM, no groupId key when absent', () => {
    const route = getDesktopPostRoute('Messages', {
      ...base,
      channelId: '~some-user',
    });
    expect(route.name).toBe('Messages');
    expect(route.params.screen).toBe('DM');
    expect('groupId' in route.params.params).toBe(false);
    expect(route.params.params.screen).toBe('Post');
  });

  test('group-DM channel -> wrapper screen GroupDM', () => {
    const route = getDesktopPostRoute('Home', {
      ...base,
      channelId: '0v4.aaaaa.bbbbb',
    });
    expect(route.params.screen).toBe('GroupDM');
  });

  test('notes channel -> Home even when the last open tab is Messages', () => {
    const route = getDesktopPostRoute('Messages', {
      ...base,
      channelId: 'notes/~zod/blog',
      groupId: '~zod/tlon',
    });
    expect(route.name).toBe('Home');
    expect(route.params.screen).toBe('Channel');
  });

  test('selectedPostId is threaded onto both wrapper and nested Post params', () => {
    const route = getDesktopPostRoute('Home', {
      ...base,
      channelId: 'chat/~group/channel',
      groupId: '~group',
      selectedPostId: '~author/789.000',
    });
    expect(route.params.params.selectedPostId).toBe('~author/789.000');
    expect(route.params.params.params.selectedPostId).toBe('~author/789.000');
  });

  test('selectedPostId omitted is preserved as undefined (not coerced) in both places', () => {
    const route = getDesktopPostRoute('Home', {
      ...base,
      channelId: 'chat/~group/channel',
      groupId: '~group',
    });
    expect(route.params.params.selectedPostId).toBeUndefined();
    expect(route.params.params.params.selectedPostId).toBeUndefined();
  });
});

describe('getDesktopGroupInviteRoute', () => {
  test('opens the clicked invite in the nested desktop ChatList', () => {
    expect(getDesktopGroupInviteRoute('~zod/test-group')).toEqual({
      name: 'Home',
      params: {
        screen: 'ChatList',
        params: {
          previewGroupId: '~zod/test-group',
          previewGroupFromInviteNotification: true,
        },
      },
    });
  });
});
