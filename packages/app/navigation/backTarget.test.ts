import { describe, expect, test } from 'vitest';

import { resolveChannelBackTarget } from './backTarget';

const CHANNEL_ID = 'chat/~zod/general';
const OTHER_CHANNEL_ID = 'chat/~bus/random';
const DM_ID = '~nec';
const GROUP_DM_ID = '0v3.abcde';

describe('resolveChannelBackTarget', () => {
  test('pops when the previous route is the exact target channel', () => {
    // Normal in-channel thread back: [..., Channel(target), Post]. The route
    // beneath Post is the target, so name-only pop lands exactly on it.
    expect(
      resolveChannelBackTarget(
        { name: 'Channel', params: { channelId: CHANNEL_ID } },
        'Post',
        { screenName: 'Channel', channelId: CHANNEL_ID }
      )
    ).toBe('pop-to-existing');
  });

  test('replaces when the previous route is the originating DM', () => {
    // The Linear repro: [..., DM(origin), Post(group channel)]. Replacing keeps
    // the originating DM beneath the swapped Post route.
    expect(
      resolveChannelBackTarget(
        { name: 'DM', params: { channelId: DM_ID } },
        'Post',
        { screenName: 'Channel', channelId: CHANNEL_ID }
      )
    ).toBe('replace-post');
  });

  test('replaces when previous route shares the name but a different channelId', () => {
    // Must not navigate-pop onto a different same-name channel (and overwrite
    // its params).
    expect(
      resolveChannelBackTarget(
        { name: 'Channel', params: { channelId: OTHER_CHANNEL_ID } },
        'Post',
        { screenName: 'Channel', channelId: CHANNEL_ID }
      )
    ).toBe('replace-post');
  });

  test('pops for a matching DM target', () => {
    expect(
      resolveChannelBackTarget(
        { name: 'DM', params: { channelId: DM_ID } },
        'Post',
        { screenName: 'DM', channelId: DM_ID }
      )
    ).toBe('pop-to-existing');
  });

  test('pops for a matching GroupDM target', () => {
    expect(
      resolveChannelBackTarget(
        { name: 'GroupDM', params: { channelId: GROUP_DM_ID } },
        'Post',
        { screenName: 'GroupDM', channelId: GROUP_DM_ID }
      )
    ).toBe('pop-to-existing');
  });

  test('replaces when channelId matches but the name differs', () => {
    // Shared channelId under a different screen name is not the target.
    expect(
      resolveChannelBackTarget(
        { name: 'DM', params: { channelId: CHANNEL_ID } },
        'Post',
        { screenName: 'Channel', channelId: CHANNEL_ID }
      )
    ).toBe('replace-post');
  });

  test('falls back to pop when the focused route is not Post', () => {
    expect(
      resolveChannelBackTarget(
        { name: 'DM', params: { channelId: DM_ID } },
        'Channel',
        { screenName: 'Channel', channelId: CHANNEL_ID }
      )
    ).toBe('pop-to-existing');
  });

  test('replaces when there is no previous route beneath Post', () => {
    expect(
      resolveChannelBackTarget(undefined, 'Post', {
        screenName: 'Channel',
        channelId: CHANNEL_ID,
      })
    ).toBe('replace-post');
  });
});
