import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  _testing,
  createRoleMentionResolver,
  getRoleMentionResolver,
  publishRoleMentionResolver,
  roleMentionScopeFor,
  unpublishRoleMentionResolver,
} from './role-mention-scope.js';
import { ALL_ONLY } from './urbit/story.js';

const NEST = 'chat/~zod/General';
const GROUP = '~zod/crew';

function setup(
  overrides: Partial<Parameters<typeof createRoleMentionResolver>[0]> = {}
) {
  let time = 1_000_000;
  const channelToGroup = new Map([[NEST, GROUP]]);
  const fetchRoleIds = vi.fn(async (_flag: string) => ['admin', 'mods']);
  const refreshChannelGroups = vi.fn(async () => {});
  const resolver = createRoleMentionResolver({
    channelToGroup,
    refreshChannelGroups,
    fetchRoleIds,
    now: () => time,
    ...overrides,
  });
  return {
    resolver,
    channelToGroup,
    fetchRoleIds,
    refreshChannelGroups,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

afterEach(() => {
  _testing.clearResolvers();
});

describe('createRoleMentionResolver', () => {
  it('fetches once per group within the TTL', async () => {
    const t = setup();
    expect(await t.resolver.roleIdsForNest(NEST)).toEqual(
      new Set(['admin', 'mods'])
    );
    t.advance(59_000);
    await t.resolver.roleIdsForNest(NEST);
    expect(t.fetchRoleIds).toHaveBeenCalledExactlyOnceWith(GROUP);
  });

  it('shares an in-flight fetch between concurrent lookups', async () => {
    const t = setup();
    const [a, b] = await Promise.all([
      t.resolver.roleIdsForNest(NEST),
      t.resolver.roleIdsForNest(NEST),
    ]);
    expect(a).toBe(b);
    expect(t.fetchRoleIds).toHaveBeenCalledTimes(1);
  });

  it('caches an empty role list for the full TTL', async () => {
    const t = setup();
    t.fetchRoleIds.mockResolvedValueOnce([]);
    expect(await t.resolver.roleIdsForNest(NEST)).toEqual(new Set());
    t.advance(30_000);
    expect(await t.resolver.roleIdsForNest(NEST)).toEqual(new Set());
    expect(t.fetchRoleIds).toHaveBeenCalledTimes(1);
  });

  it('shares one fetch between nests of the same group', async () => {
    const t = setup();
    t.channelToGroup.set('heap/~zod/pics', GROUP);
    await t.resolver.roleIdsForNest(NEST);
    await t.resolver.roleIdsForNest('heap/~zod/pics');
    expect(t.fetchRoleIds).toHaveBeenCalledExactlyOnceWith(GROUP);
  });

  it('refetches after the TTL', async () => {
    const t = setup();
    await t.resolver.roleIdsForNest(NEST);
    t.fetchRoleIds.mockResolvedValueOnce(['admin']);
    t.advance(60_000);
    expect(await t.resolver.roleIdsForNest(NEST)).toEqual(new Set(['admin']));
    expect(t.fetchRoleIds).toHaveBeenCalledTimes(2);
  });

  it('matches a nest case-insensitively', async () => {
    const t = setup();
    expect(await t.resolver.roleIdsForNest('CHAT/~zod/general')).toEqual(
      new Set(['admin', 'mods'])
    );
    expect(t.refreshChannelGroups).not.toHaveBeenCalled();
  });

  it('yields null on a failed fetch and never throws', async () => {
    const log = vi.fn();
    const t = setup({ log });
    t.fetchRoleIds.mockRejectedValueOnce(new Error('offline'));
    await expect(t.resolver.roleIdsForNest(NEST)).resolves.toBeNull();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('offline'));
  });

  it('caches a failure briefly, then recovers', async () => {
    const t = setup();
    t.fetchRoleIds.mockRejectedValueOnce(new Error('offline'));
    await t.resolver.roleIdsForNest(NEST);
    t.advance(9_000);
    expect(await t.resolver.roleIdsForNest(NEST)).toBeNull();
    expect(t.fetchRoleIds).toHaveBeenCalledTimes(1);
    t.advance(1_000);
    expect(await t.resolver.roleIdsForNest(NEST)).toEqual(
      new Set(['admin', 'mods'])
    );
    expect(t.fetchRoleIds).toHaveBeenCalledTimes(2);
  });

  it('refreshes the channel index once for an unknown nest', async () => {
    const t = setup();
    t.refreshChannelGroups.mockImplementationOnce(async () => {
      t.channelToGroup.set('chat/~zod/new', GROUP);
    });
    expect(await t.resolver.roleIdsForNest('chat/~zod/new')).toEqual(
      new Set(['admin', 'mods'])
    );
    expect(t.refreshChannelGroups).toHaveBeenCalledTimes(1);
  });

  it('falls back to null when the nest is still unknown after a refresh', async () => {
    const t = setup();
    expect(await t.resolver.roleIdsForNest('chat/~zod/gone')).toBeNull();
    expect(t.refreshChannelGroups).toHaveBeenCalledTimes(1);
    expect(t.fetchRoleIds).not.toHaveBeenCalled();
  });

  it('falls back to null when the refresh rejects', async () => {
    const t = setup();
    t.refreshChannelGroups.mockRejectedValueOnce(new Error('scry failed'));
    await expect(
      t.resolver.roleIdsForNest('chat/~zod/gone')
    ).resolves.toBeNull();
    expect(t.fetchRoleIds).not.toHaveBeenCalled();
  });
});

describe('publication', () => {
  it('keeps resolvers apart by account', async () => {
    const primary = setup();
    const secondary = setup({ fetchRoleIds: async () => ['ops'] });
    publishRoleMentionResolver('primary', primary.resolver);
    publishRoleMentionResolver('secondary', secondary.resolver);
    expect(
      await roleMentionScopeFor(
        'secondary',
        { kind: 'channel', nest: NEST },
        '@ops'
      )
    ).toEqual({ roleIds: new Set(['ops']) });
    expect(primary.fetchRoleIds).not.toHaveBeenCalled();
  });

  it('unpublishes only the resolver that is registered', () => {
    const old = setup().resolver;
    const replacement = setup().resolver;
    publishRoleMentionResolver('primary', old);
    publishRoleMentionResolver('primary', replacement);
    unpublishRoleMentionResolver('primary', old);
    expect(getRoleMentionResolver('primary')).toBe(replacement);
    unpublishRoleMentionResolver('primary', replacement);
    expect(getRoleMentionResolver('primary')).toBeNull();
  });
});

describe('roleMentionScopeFor', () => {
  const channel = { kind: 'channel' as const, nest: NEST };

  it.each([
    ['text with no @token', 'plain text'],
    ['@all-only text', 'see @all and @ALL'],
    ['a partial word', 'mail a@admin.io or @admin_team'],
  ])('does no lookup for %s', async (_name, text) => {
    const t = setup();
    publishRoleMentionResolver('primary', t.resolver);
    expect(await roleMentionScopeFor('primary', channel, text)).toBe(ALL_ONLY);
    expect(t.fetchRoleIds).not.toHaveBeenCalled();
    expect(t.refreshChannelGroups).not.toHaveBeenCalled();
  });

  it('is @all only for a DM, without lookup', async () => {
    const t = setup();
    publishRoleMentionResolver('primary', t.resolver);
    expect(
      await roleMentionScopeFor('primary', { kind: 'dm' }, 'ping @admin')
    ).toBe(ALL_ONLY);
    expect(t.fetchRoleIds).not.toHaveBeenCalled();
  });

  it('uses the group roles for a channel', async () => {
    const t = setup();
    publishRoleMentionResolver('primary', t.resolver);
    expect(
      await roleMentionScopeFor('primary', channel, 'ping @admin')
    ).toEqual({ roleIds: new Set(['admin', 'mods']) });
  });

  it('falls back to ALL_ONLY when the roles cannot be read', async () => {
    const t = setup();
    t.fetchRoleIds.mockRejectedValue(new Error('offline'));
    publishRoleMentionResolver('primary', t.resolver);
    expect(await roleMentionScopeFor('primary', channel, 'ping @admin')).toBe(
      ALL_ONLY
    );
  });

  it('falls back to ALL_ONLY with no published resolver for the account', async () => {
    publishRoleMentionResolver('other', setup().resolver);
    expect(await roleMentionScopeFor('primary', channel, 'ping @admin')).toBe(
      ALL_ONLY
    );
  });
});
