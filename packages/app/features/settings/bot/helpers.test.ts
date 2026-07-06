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
      host: '~zod',
      channelId: 'general',
    });
    expect(parseChannelRuleKey('zod/general/extra')).toEqual({
      host: 'zod',
      channelId: 'general/extra',
    });
    expect(parseChannelRuleKey('nonsense')).toBeNull();
  });

  it('normalizes keys to chat/~host/channel form', () => {
    expect(normalizeChannelRuleKey('zod/general')).toBe('chat/~zod/general');
    expect(normalizeChannelRuleKey('chat/~zod/general')).toBe(
      'chat/~zod/general'
    );
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
      channelRules: {
        'chat/~zod/general': { mode: 'allowlist', allowedShips: ['~nec'] },
        'chat/~zod/random': { mode: 'bogus', allowedShips: [] },
      },
    });
    expect(config.dmAllowlist).toEqual([]);
    expect(config.channelRules['chat/~zod/general'].mode).toBe('allowlist');
    expect(config.channelRules['chat/~zod/random'].mode).toBe('open');
    expect(config.autoAcceptDmInvites).toBe(false);
  });

  it('builds channel rule drafts including model overrides', () => {
    const drafts = buildChannelRuleDrafts(
      normalizeTlonbotConfig({
        channelRules: {
          'zod/general': { mode: 'allowlist', allowedShips: ['nec'] },
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
    expect(drafts['chat/~zod/random']).toEqual({
      mode: 'open',
      allowedShips: '',
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
    expect(config.channelRules['chat/~zod/general']).toEqual({
      mode: 'allowlist',
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
      '~zod%my-group'
    );
    expect(
      resolveGroupFull(groups, 'zod', 'unknown', 'chat/~zod/general')
    ).toBe('~zod%my-group');
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
