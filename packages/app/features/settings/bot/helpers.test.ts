import { describe, expect, it, vi } from 'vitest';

import {
  buildChannelModelEntries,
  buildChannelRuleDrafts,
  buildConfigFromChatValues,
  buildMergedChannelModelEntries,
  formatShipList,
  getModelFormValues,
  groupChannelEntries,
  hasGroupMembership,
  haveChannelModelEntriesChanged,
  mergeChannelRules,
  normalizeChannelRuleKey,
  normalizeMoonName,
  normalizeProviderConfig,
  normalizeShip,
  normalizeShipList,
  normalizeTlonbotConfig,
  parseChannelRuleKey,
  resolveGroupFull,
  runApplySteps,
  safeKeySummary,
  toBackendModel,
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
    // only the shared default MODEL on openrouter maps to Basic
    expect(
      toDisplayProviderId(config, 'openrouter', 'minimax/minimax-m3')
    ).toBe('basic');
    // a custom openrouter model must stay openrouter (else a save would pin it
    // to minimax and silently rewrite the user's real model)
    expect(
      toDisplayProviderId(config, 'openrouter', 'anthropic/claude-3.5')
    ).toBe('openrouter');
    // with a personal openrouter key, even the default model stays openrouter
    expect(
      toDisplayProviderId(
        { ...config, keys: { openrouter: 'sk-or-abc' } },
        'openrouter',
        'minimax/minimax-m3'
      )
    ).toBe('openrouter');
    expect(toDisplayProviderId(config, 'anthropic', 'claude-1')).toBe(
      'anthropic'
    );
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
    expect(
      safeKeySummary(config, 'anthropic'.replace('anthropic', 'missing'))
    ).toBe('Not set');
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

  it('treats the first non-channel model as primary when none is flagged', () => {
    // legacy shape: {provider, model} entries with no `primary` flag
    const values = getModelFormValues({
      keys: { anthropic: 'sk-ant-xxx' },
      defaultKeys: {},
      models: [
        { provider: 'anthropic', model: 'claude-1' },
        { provider: 'openai', model: 'gpt-x' },
        {
          provider: 'anthropic',
          model: 'channel-model',
          channels: ['chat/~zod/general'],
        },
      ],
    });
    // first non-channel model is the primary (not a fall-through to Basic)
    expect(values.provider).toBe('anthropic');
    expect(values.model).toBe('claude-1');
    // the remaining non-channel model becomes a fallback (not duplicated)
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
    // a legacy `restricted` value canonicalizes to `allowlist` (the backend's
    // real vocabulary), never silently to `open`
    expect(config.channelRules['chat/~zod/general'].mode).toBe('allowlist');
    expect(config.channelRules['chat/~zod/general'].allowedShips).toEqual([
      '~nec',
    ]);
    expect(config.channelRules['chat/~zod/random'].mode).toBe('open');
    // anything that isn't an explicit `open` becomes `allowlist`, so a rule
    // never silently loses its allowlist on round-trip
    expect(config.channelRules['chat/~zod/unknown'].mode).toBe('allowlist');
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
          // legacy `restricted` values still read as an allowlist
          'zod/general': { mode: 'restricted', allowedShips: ['nec'] },
          // a rule with omitted allowedShips reads as an explicit defaults snapshot
          'zod/inherited': { mode: 'allowlist' } as {
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
            // the shared default model on openrouter (no user key) reads as Basic
            model: 'minimax/minimax-m3',
            channels: ['chat/~zod/general'],
          },
        ],
      }
    );
    expect(drafts['chat/~zod/general']).toEqual({
      mode: 'allowlist',
      allowedShips: '~nec',
      modelOverrideProvider: 'basic',
      modelOverride: 'minimax/minimax-m3',
    });
    // a group channel with no explicit rule reads as an explicit snapshot of the
    // default authorized ships (no inherited flag), not an open channel
    expect(drafts['chat/~zod/random']).toEqual({
      mode: 'allowlist',
      allowedShips: '~bus',
    });
    // a rule that omits allowedShips also reads as the defaults snapshot
    expect(drafts['chat/~zod/inherited']).toEqual({
      mode: 'allowlist',
      allowedShips: '~bus',
    });
  });

  it('saves each monitored channel with its own explicit allowlist', () => {
    const config = buildConfigFromChatValues({
      dmAllowlist: '',
      defaultAuthorizedShips: '~zod, ~bus',
      groupInviteAllowlist: '',
      autoAcceptDmInvites: false,
      autoDiscoverChannels: false,
      channelRuleDrafts: {
        // each allowlist channel carries its own explicit list — there is no
        // follows-defaults state, so this is saved as-is (not re-materialized
        // from the current defaultAuthorizedShips)
        'chat/~zod/general': {
          mode: 'allowlist',
          allowedShips: '~nec',
        },
        'chat/~zod/private': {
          mode: 'allowlist',
          allowedShips: '~mel',
        },
      },
    });
    expect(config.channelRules['chat/~zod/general']).toEqual({
      mode: 'allowlist',
      allowedShips: ['~nec'],
    });
    expect(config.groupChannels).toContain('chat/~zod/general');
    expect(config.channelRules['chat/~zod/private']).toEqual({
      mode: 'allowlist',
      allowedShips: ['~mel'],
    });
    expect(config.groupChannels).toContain('chat/~zod/private');
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
    // the `allowlist` draft mode is written back as the backend's `allowlist`
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

  it('writes Basic overrides back as the basic provider with the fixed default model', () => {
    const entries = buildChannelModelEntries({
      'chat/~zod/general': {
        mode: 'open',
        allowedShips: '',
        modelOverrideProvider: 'basic',
        modelOverride: 'some/model',
      },
    });
    expect(entries).toEqual([
      {
        provider: 'basic',
        model: 'minimax/minimax-m3',
        channels: ['chat/~zod/general'],
      },
    ]);
  });

  it('keeps a Basic override that has no model (Basic has no model picker)', () => {
    const entries = buildChannelModelEntries({
      'chat/~zod/general': {
        mode: 'open',
        allowedShips: '',
        modelOverrideProvider: 'basic',
        modelOverride: '',
      },
    });
    expect(entries).toEqual([
      {
        provider: 'basic',
        model: 'minimax/minimax-m3',
        channels: ['chat/~zod/general'],
      },
    ]);
  });

  it('still drops a non-Basic override missing its model', () => {
    const entries = buildChannelModelEntries({
      'chat/~zod/general': {
        mode: 'open',
        allowedShips: '',
        modelOverrideProvider: 'anthropic',
        modelOverride: '',
      },
    });
    expect(entries).toEqual([]);
  });
});

describe('toBackendModel', () => {
  it('persists basic as its own provider and pins the model to the default', () => {
    expect(toBackendModel('basic', '')).toEqual({
      provider: 'basic',
      model: 'minimax/minimax-m3',
    });
    // a stale/leftover model on a Basic pick is ignored
    expect(toBackendModel('basic', 'anthropic/claude-1')).toEqual({
      provider: 'basic',
      model: 'minimax/minimax-m3',
    });
  });

  it('passes real providers and their models through unchanged', () => {
    expect(toBackendModel('anthropic', 'claude-1')).toEqual({
      provider: 'anthropic',
      model: 'claude-1',
    });
    expect(toBackendModel('openrouter', 'some/model')).toEqual({
      provider: 'openrouter',
      model: 'some/model',
    });
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

describe('mergeChannelRules', () => {
  it('drops inherited server rules (restricted, no allowedShips) so the CRD is not sent an allowedShips-less rule', () => {
    const serverRules = {
      'chat/~zod/inherited': { mode: 'restricted' as const },
      'chat/~zod/explicit': {
        mode: 'restricted' as const,
        allowedShips: ['~bus'],
      },
    };
    const merged = mergeChannelRules(serverRules, {}, []);
    expect(merged).toEqual({
      'chat/~zod/explicit': { mode: 'restricted', allowedShips: ['~bus'] },
    });
    expect(merged['chat/~zod/inherited']).toBeUndefined();
  });

  it('keeps an explicit block-all rule (restricted with empty allowedShips)', () => {
    const serverRules = {
      'chat/~zod/blocked': { mode: 'restricted' as const, allowedShips: [] },
    };
    const merged = mergeChannelRules(serverRules, {}, []);
    expect(merged['chat/~zod/blocked']).toEqual({
      mode: 'restricted',
      allowedShips: [],
    });
  });

  it('overlays dirty edits and preserves untouched server rules', () => {
    const serverRules = {
      'chat/~zod/other': { mode: 'open' as const, allowedShips: [] },
    };
    const nextRules = {
      'chat/~zod/edited': {
        mode: 'restricted' as const,
        allowedShips: ['~bus'],
      },
    };
    const merged = mergeChannelRules(serverRules, nextRules, [
      'chat/~zod/edited',
    ]);
    expect(merged).toEqual({
      'chat/~zod/other': { mode: 'open', allowedShips: [] },
      'chat/~zod/edited': { mode: 'restricted', allowedShips: ['~bus'] },
    });
  });

  it('deletes a rule whose dirty key is absent from nextRules (channel reset to inherited)', () => {
    const serverRules = {
      'chat/~zod/reset': {
        mode: 'restricted' as const,
        allowedShips: ['~bus'],
      },
    };
    const merged = mergeChannelRules(serverRules, {}, ['chat/~zod/reset']);
    expect(merged['chat/~zod/reset']).toBeUndefined();
  });

  it('normalizes legacy un-normalized server keys before overlaying dirty edits', () => {
    const serverRules = {
      'zod/general': { mode: 'restricted' as const, allowedShips: ['~bus'] },
    };
    const nextRules = {
      'chat/~zod/general': {
        mode: 'open' as const,
        allowedShips: [],
      },
    };
    const merged = mergeChannelRules(serverRules, nextRules, [
      'chat/~zod/general',
    ]);
    // The normalized key is updated in place — no stale duplicate under the
    // legacy key.
    expect(merged).toEqual({
      'chat/~zod/general': { mode: 'open', allowedShips: [] },
    });
  });
});

describe('runApplySteps', () => {
  type Snap = { nickname: string; model: string; chat: string };
  const initial: Snap = { nickname: 'old', model: 'old', chat: 'old' };

  it('runs steps in order and commits a cumulative snapshot after each success', async () => {
    const order: string[] = [];
    const commits: Snap[] = [];
    await runApplySteps(
      initial,
      [
        {
          run: async () => {
            order.push('nickname');
          },
          commit: { nickname: 'new' },
        },
        {
          run: async () => {
            order.push('model');
          },
          commit: { model: 'new' },
        },
      ],
      (snap) => commits.push({ ...snap })
    );
    expect(order).toEqual(['nickname', 'model']);
    expect(commits).toEqual([
      { nickname: 'new', model: 'old', chat: 'old' },
      { nickname: 'new', model: 'new', chat: 'old' },
    ]);
  });

  it('commits only the steps that succeeded before a failure, then rethrows', async () => {
    const commits: Snap[] = [];
    const laterRun = vi.fn();
    await expect(
      runApplySteps(
        initial,
        [
          { run: async () => {}, commit: { nickname: 'new' } },
          {
            run: async () => {
              throw new Error('boom');
            },
            commit: { model: 'new' },
          },
          { run: laterRun, commit: { chat: 'new' } },
        ],
        (snap) => commits.push({ ...snap })
      )
    ).rejects.toThrow('boom');
    // Only the first step advanced the snapshot; the failing step and the one
    // after it never committed, and the later step never ran.
    expect(commits).toEqual([{ nickname: 'new', model: 'old', chat: 'old' }]);
    expect(laterRun).not.toHaveBeenCalled();
  });

  it('does nothing for an empty step list', async () => {
    const onCommit = vi.fn();
    await runApplySteps(initial, [], onCommit);
    expect(onCommit).not.toHaveBeenCalled();
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
