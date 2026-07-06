import { describe, expect, it } from 'vitest';

import {
  buildChannelRuleDrafts,
  buildConfigFromChatValues,
  buildMergedChannelModelEntries,
  formatShipList,
  getModelFormValues,
  groupChannelEntries,
  hasGroupMembership,
  haveChannelModelEntriesChanged,
  normalizeChannelRuleKey,
  normalizeMoonName,
  normalizeProviderConfig,
  normalizeShip,
  normalizeShipList,
  normalizeTlonbotConfig,
  parseChannelRuleKey,
  resolveGroupFull,
  safeKeySummary,
  toDisplayProviderId,
  validateProviderKey,
} from './helpers';

describe('ship normalization', () => {
  it('normalizes ships to a single leading sig', () => {
    expect(normalizeShip('zod')).toBe('~zod');
    expect(normalizeShip('~~zod')).toBe('~zod');
    expect(normalizeShip('@zod')).toBe('~zod');
    expect(normalizeShip('  ~zod  ')).toBe('~zod');
    expect(normalizeShip('')).toBeNull();
    expect(normalizeShip('~')).toBeNull();
  });

  it('splits, dedupes, and normalizes ship lists', () => {
    expect(normalizeShipList('~zod, nec ~zod\n bus')).toEqual([
      '~zod',
      '~nec',
      '~bus',
    ]);
    expect(normalizeShipList('')).toEqual([]);
  });

  it('formats ship lists as comma-separated strings', () => {
    expect(formatShipList(['zod', '~zod', 'nec'])).toBe('~zod, ~nec');
  });

  it('normalizes moon names against their parent ship', () => {
    expect(normalizeMoonName('molten', 'zod')).toBe('~molten-zod');
    expect(normalizeMoonName('~molten-zod', '~zod')).toBe('~molten-zod');
  });
});

describe('channel rule keys', () => {
  it('parses channel rule keys with and without the chat/ prefix', () => {
    expect(parseChannelRuleKey('chat/~zod/general')).toEqual({
      app: 'chat',
      host: '~zod',
      channelId: 'general',
    });
    expect(parseChannelRuleKey('zod/general/extra')).toEqual({
      app: 'chat',
      host: 'zod',
      channelId: 'general/extra',
    });
    // non-chat channel nests keep their app prefix
    expect(parseChannelRuleKey('heap/~zod/gallery')).toEqual({
      app: 'heap',
      host: '~zod',
      channelId: 'gallery',
    });
    expect(parseChannelRuleKey('diary/~zod/plans')).toEqual({
      app: 'diary',
      host: '~zod',
      channelId: 'plans',
    });
    expect(parseChannelRuleKey('nonsense')).toBeNull();
  });

  it('normalizes keys to app/~host/channel form, preserving the app', () => {
    expect(normalizeChannelRuleKey('zod/general')).toBe('chat/~zod/general');
    expect(normalizeChannelRuleKey('chat/~zod/general')).toBe(
      'chat/~zod/general'
    );
    // heap/diary nests round-trip instead of being rewritten as chat
    expect(normalizeChannelRuleKey('heap/~zod/gallery')).toBe(
      'heap/~zod/gallery'
    );
    expect(normalizeChannelRuleKey('diary/zod/plans')).toBe('diary/~zod/plans');
    expect(normalizeChannelRuleKey('nonsense')).toBe('nonsense');
  });
});

describe('provider config', () => {
  it('normalizes provider config and legacy default key field', () => {
    expect(normalizeProviderConfig(null)).toEqual({
      keys: {},
      models: [],
      defaultKeys: {},
    });
    expect(
      normalizeProviderConfig({
        default: { basic: { key: 'x' } },
      }).defaultKeys
    ).toEqual({ basic: { key: 'x' } });
  });

  it('maps default-key openrouter usage to the basic provider', () => {
    const config = normalizeProviderConfig({
      keys: {},
      models: [],
      defaultKeys: { basic: { key: 'x' } },
    });
    expect(toDisplayProviderId(config, 'openrouter')).toBe('basic');
    expect(
      toDisplayProviderId(
        { ...config, keys: { openrouter: 'sk-or-abc' } },
        'openrouter'
      )
    ).toBe('openrouter');
    expect(toDisplayProviderId(config, 'anthropic')).toBe('anthropic');
  });

  it('redacts stored keys instead of rendering them in full', () => {
    const config = normalizeProviderConfig({
      keys: { anthropic: 'sk-ant-secret-abcd1234', openai: 'x' },
      models: [],
      defaultKeys: { basic: { key: 'shared' } },
    });
    const summary = safeKeySummary(config, 'anthropic');
    expect(summary).toBe('••••1234');
    expect(summary).not.toContain('secret');
    // short keys are masked entirely
    expect(safeKeySummary(config, 'openai')).toBe('••••');
    expect(safeKeySummary(config, 'anthropic'.replace('anthropic', 'missing'))).toBe(
      'Not set'
    );
    expect(safeKeySummary(config, 'basic')).toBe('Included');
  });

  it('derives model form values from the provider config', () => {
    const empty = getModelFormValues(undefined);
    expect(empty.provider).toBe('basic');
    expect(empty.model).toBe('');

    const values = getModelFormValues({
      keys: { anthropic: 'sk-ant-xxx' },
      defaultKeys: {},
      models: [
        { provider: 'anthropic', model: 'claude-1', primary: true },
        { provider: 'openai', model: 'gpt-x' },
        {
          provider: 'anthropic',
          model: 'channel-model',
          channels: ['chat/~zod/general'],
        },
      ],
    });
    expect(values.provider).toBe('anthropic');
    expect(values.model).toBe('claude-1');
    expect(values.fallbacks).toEqual([{ provider: 'openai', model: 'gpt-x' }]);
  });
});

describe('tlonbot config', () => {
  it('normalizes partial configs', () => {
    const config = normalizeTlonbotConfig({
      defaultAuthorizedShips: ['~bus'],
      channelRules: {
        'chat/~zod/general': { mode: 'restricted', allowedShips: ['~nec'] },
        'chat/~zod/random': { mode: 'open', allowedShips: [] },
        'chat/~zod/unknown': { mode: 'bogus', allowedShips: [] },
        'chat/~zod/inherit': { mode: 'restricted' } as {
          mode: string;
          allowedShips: string[];
        },
      },
    });
    expect(config.dmAllowlist).toEqual([]);
    expect(config.channelRules['chat/~zod/general'].mode).toBe('restricted');
    expect(config.channelRules['chat/~zod/general'].allowedShips).toEqual([
      '~nec',
    ]);
    expect(config.channelRules['chat/~zod/random'].mode).toBe('open');
    // anything that isn't an explicit `open` stays restricted, so a rule never
    // silently loses its allowlist on round-trip
    expect(config.channelRules['chat/~zod/unknown'].mode).toBe('restricted');
    // an explicit empty allowlist is preserved (block-all), not widened
    expect(config.channelRules['chat/~zod/unknown'].allowedShips).toEqual([]);
    // an omitted allowedShips is preserved as omitted (inherits defaults), not
    // materialized into a list
    expect(
      config.channelRules['chat/~zod/inherit'].allowedShips
    ).toBeUndefined();
    expect(config.autoAcceptDmInvites).toBe(false);
  });

  it('builds channel rule drafts including model overrides', () => {
    const drafts = buildChannelRuleDrafts(
      normalizeTlonbotConfig({
        defaultAuthorizedShips: ['~bus'],
        channelRules: {
          'zod/general': { mode: 'restricted', allowedShips: ['nec'] },
          // explicit restricted rule with omitted allowedShips -> inherited
          'zod/inherited': { mode: 'restricted' } as {
            mode: string;
            allowedShips: string[];
          },
        },
        groupChannels: ['zod/general', 'zod/random'],
      }),
      {
        keys: {},
        defaultKeys: { basic: { key: 'x' } },
        models: [
          {
            provider: 'openrouter',
            model: 'some/model',
            channels: ['chat/~zod/general'],
          },
        ],
      }
    );
    expect(drafts['chat/~zod/general']).toEqual({
      mode: 'allowlist',
      allowedShips: '~nec',
      modelOverrideProvider: 'basic',
      modelOverride: 'some/model',
    });
    // a group channel with no explicit rule defaults to restricted with the
    // default authorized ships (flagged inherited), not an open channel
    expect(drafts['chat/~zod/random']).toEqual({
      mode: 'allowlist',
      allowedShips: '~bus',
      inheritsDefaultShips: true,
    });
    // an explicit restricted rule that omits allowedShips is also inherited
    expect(drafts['chat/~zod/inherited']).toEqual({
      mode: 'allowlist',
      allowedShips: '~bus',
      inheritsDefaultShips: true,
    });
  });

  it('omits allowedShips for inherited channels so they follow the defaults', () => {
    const config = buildConfigFromChatValues({
      dmAllowlist: '',
      defaultAuthorizedShips: '~zod, ~bus',
      groupInviteAllowlist: '',
      autoAcceptDmInvites: false,
      autoDiscoverChannels: false,
      channelRuleDrafts: {
        // inherited: written without allowedShips (backend keeps inheriting)
        'chat/~zod/general': {
          mode: 'allowlist',
          allowedShips: '~nec',
          inheritsDefaultShips: true,
        },
        // an explicitly edited rule keeps its own allowlist
        'chat/~zod/private': {
          mode: 'allowlist',
          allowedShips: '~mel',
        },
      },
    });
    expect(config.channelRules['chat/~zod/general']).toEqual({
      mode: 'restricted',
    });
    expect(config.channelRules['chat/~zod/private']).toEqual({
      mode: 'restricted',
      allowedShips: ['~mel'],
    });
  });

  it('builds a config payload from chat form values', () => {
    const config = buildConfigFromChatValues({
      dmAllowlist: 'zod, nec',
      defaultAuthorizedShips: '~zod',
      groupInviteAllowlist: '',
      autoAcceptDmInvites: true,
      autoDiscoverChannels: false,
      channelRuleDrafts: {
        'zod/general': { mode: 'allowlist', allowedShips: 'nec bus' },
        'chat/~zod/random': { mode: 'open', allowedShips: '~nec' },
      },
    });
    expect(config.dmAllowlist).toEqual(['~zod', '~nec']);
    // the `allowlist` draft mode is written back as the backend's `restricted`
    expect(config.channelRules['chat/~zod/general']).toEqual({
      mode: 'restricted',
      allowedShips: ['~nec', '~bus'],
    });
    // open channels drop their allowlists
    expect(config.channelRules['chat/~zod/random'].allowedShips).toEqual([]);
    expect(config.groupChannels.sort()).toEqual([
      'chat/~zod/general',
      'chat/~zod/random',
    ]);
  });
});

describe('channel model overrides', () => {
  const baseline = {
    'chat/~zod/general': { mode: 'open' as const, allowedShips: '' },
  };

  it('detects override changes independent of other rule fields', () => {
    expect(
      haveChannelModelEntriesChanged(baseline, {
        'chat/~zod/general': { mode: 'allowlist', allowedShips: '~nec' },
      })
    ).toBe(false);
    expect(
      haveChannelModelEntriesChanged(baseline, {
        'chat/~zod/general': {
          mode: 'open',
          allowedShips: '',
          modelOverrideProvider: 'anthropic',
          modelOverride: 'claude-1',
        },
      })
    ).toBe(true);
  });

  it('preserves override entries for untouched channels when merging', () => {
    const merged = buildMergedChannelModelEntries(
      {
        keys: {},
        defaultKeys: {},
        models: [
          {
            provider: 'anthropic',
            model: 'claude-1',
            channels: ['chat/~bus/untouched', 'chat/~zod/general'],
          },
        ],
      },
      baseline,
      {
        'chat/~zod/general': {
          mode: 'open',
          allowedShips: '',
          modelOverrideProvider: 'openai',
          modelOverride: 'gpt-x',
        },
      }
    );
    expect(merged).toEqual([
      {
        provider: 'anthropic',
        model: 'claude-1',
        channels: ['chat/~bus/untouched'],
      },
      {
        provider: 'openai',
        model: 'gpt-x',
        channels: ['chat/~zod/general'],
      },
    ]);
  });
});

describe('channel grouping', () => {
  const groups = {
    '~zod': {
      'my-group': {
        title: 'My Group',
        channels: { general: 'General', random: 'Random' },
      },
    },
  };

  it('groups channels by host and group', () => {
    const entries = groupChannelEntries(groups, {});
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe('My Group');
    expect(entries[0].channels.map((c) => c.key)).toEqual([
      'chat/~zod/general',
      'chat/~zod/random',
    ]);
  });

  it('surfaces rules for channels missing from the ship listing', () => {
    const entries = groupChannelEntries(groups, {
      'chat/~bus/ghost': { mode: 'open', allowedShips: '' },
    });
    const ghostGroup = entries.find((entry) => entry.host === '~bus');
    expect(ghostGroup?.group).toBe('unknown');
    expect(ghostGroup?.channels[0].key).toBe('chat/~bus/ghost');
  });

  it('resolves full group ids for join requests', () => {
    expect(resolveGroupFull(groups, '~zod', 'my-group', '')).toBe(
      '~zod/my-group'
    );
    expect(
      resolveGroupFull(groups, 'zod', 'unknown', 'chat/~zod/general')
    ).toBe('~zod/my-group');
    expect(resolveGroupFull(groups, '~bus', 'unknown', 'chat/~bus/ghost')).toBe(
      null
    );
  });

  it('checks group membership by host and group name', () => {
    expect(hasGroupMembership(groups, 'zod', 'my-group')).toBe(true);
    expect(hasGroupMembership(groups, '~zod', 'other')).toBe(false);
  });
});

describe('provider key validation', () => {
  it('validates anthropic keys', () => {
    expect(validateProviderKey('anthropic', '')).toBeTruthy();
    expect(validateProviderKey('anthropic', 'sk-nope')).toBeTruthy();
    expect(
      validateProviderKey('anthropic', `sk-ant-${'a'.repeat(40)}`)
    ).toBeTruthy();
    expect(
      validateProviderKey('anthropic', `sk-ant-${'a'.repeat(80)}`)
    ).toBeNull();
  });

  it('validates openai and openrouter key prefixes', () => {
    expect(validateProviderKey('openai', 'nope')).toBeTruthy();
    expect(validateProviderKey('openai', 'sk-abc')).toBeNull();
    expect(validateProviderKey('openrouter', 'sk-abc')).toBeTruthy();
    expect(validateProviderKey('openrouter', 'sk-or-abc')).toBeNull();
  });
});
