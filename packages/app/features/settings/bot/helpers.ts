import type {
  TlawnChannelGroups,
  TlawnChannelModelOverride,
  TlawnConfig,
  TlawnProviderConfigInfo,
} from '@tloncorp/api';

import { BASIC_DEFAULT_MODEL, BASIC_PROVIDER_ID } from './constants';

export type ChannelRuleDraft = {
  mode: 'open' | 'allowlist';
  allowedShips: string;
  modelOverrideProvider?: string;
  modelOverride?: string;
};

export type ChatFormValues = {
  dmAllowlist: string;
  defaultAuthorizedShips: string;
  groupInviteAllowlist: string;
  autoAcceptDmInvites: boolean;
  autoDiscoverChannels: boolean;
  channelRuleDrafts: Record<string, ChannelRuleDraft>;
};

export type ModelFormValues = {
  provider: string;
  model: string;
  fallbacks: { provider: string; model: string }[];
};

export type ChannelListGroup = {
  host: string;
  group: string;
  title?: string;
  channels: { key: string; label: string }[];
};

// --- channel key utilities ---

export const formatChannelHost = (host: string): string =>
  host.startsWith('~') ? host : `~${host}`;

export const parseChannelRuleKey = (
  key: string
): { host: string; channelId: string } | null => {
  const trimmed = key.trim();
  const normalized = trimmed.startsWith('chat/')
    ? trimmed.slice('chat/'.length)
    : trimmed;
  const parts = normalized.split('/');
  if (parts.length < 2) return null;
  const host = parts[0];
  const channelId = parts.slice(1).join('/');
  if (!host || !channelId) return null;
  return { host, channelId };
};

export const resolveGroupForChannel = (
  groups: TlawnChannelGroups,
  host: string,
  channelId: string
): string | null => {
  const hostKey = formatChannelHost(host);
  const hostGroups = groups[hostKey] || groups[hostKey.replace(/^~/, '')] || {};
  for (const [group, entry] of Object.entries(hostGroups)) {
    const chats = entry?.channels || {};
    if (Object.prototype.hasOwnProperty.call(chats, channelId)) {
      return group;
    }
  }
  return null;
};

export const hasGroupMembership = (
  groups: TlawnChannelGroups,
  host: string,
  group: string
): boolean => {
  const hostKey = formatChannelHost(host);
  const hostGroups = groups[hostKey] || groups[hostKey.replace(/^~/, '')] || {};
  return Object.prototype.hasOwnProperty.call(hostGroups, group);
};

export const normalizeChannelRuleKey = (key: string): string => {
  const parsed = parseChannelRuleKey(key);
  if (!parsed) return key;
  return `chat/${formatChannelHost(parsed.host)}/${parsed.channelId}`;
};

export const resolveGroupFull = (
  groups: TlawnChannelGroups,
  host: string,
  groupName: string,
  entryKey: string
): string | null => {
  const hostKey = formatChannelHost(host);
  if (groupName !== 'unknown') return `${hostKey}%${groupName}`;
  const parsed = parseChannelRuleKey(entryKey);
  if (!parsed) return null;
  const resolvedGroup = resolveGroupForChannel(
    groups,
    formatChannelHost(parsed.host),
    parsed.channelId
  );
  return resolvedGroup
    ? `${formatChannelHost(parsed.host)}%${resolvedGroup}`
    : null;
};

// --- ship list utilities ---

export const normalizeShip = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const stripped = trimmed.replace(/^[@~]+/, '');
  if (!stripped) return null;
  return `~${stripped}`;
};

export const normalizeMoonName = (moon: string, ship: string): string => {
  const strippedShip = ship.replace(/^~/, '');
  const stripped = moon.trim().replace(/^[@~]+/, '');
  const suffix = `-${strippedShip}`;
  const full = stripped.endsWith(suffix) ? stripped : `${stripped}${suffix}`;
  return `~${full}`;
};

export const normalizeShipList = (value: string): string[] => {
  const result = value
    .split(/[,\s]+/)
    .map(normalizeShip)
    .filter((ship): ship is string => Boolean(ship));
  return Array.from(new Set(result));
};

export const formatShipList = (entries: string[]): string =>
  Array.from(
    new Set(entries.map((entry) => normalizeShip(entry)).filter(Boolean))
  ).join(', ');

// --- provider config utilities ---

export const normalizeProviderConfig = (
  raw:
    | (Partial<TlawnProviderConfigInfo> & {
        default?: TlawnProviderConfigInfo['defaultKeys'];
      })
    | null
    | undefined
): TlawnProviderConfigInfo => ({
  keys: raw?.keys ?? {},
  models: raw?.models ?? [],
  defaultKeys: raw?.defaultKeys ?? raw?.default ?? {},
});

export const hasProviderCredential = (
  config: TlawnProviderConfigInfo | undefined,
  providerId: string
): boolean =>
  providerId === BASIC_PROVIDER_ID
    ? Boolean(config?.defaultKeys?.[BASIC_PROVIDER_ID])
    : Boolean(config?.keys?.[providerId]);

export const safeKeySummary = (
  config: TlawnProviderConfigInfo | undefined,
  providerId: string
): string => {
  if (providerId === BASIC_PROVIDER_ID) return 'Included';
  return config?.keys?.[providerId] || 'Not set';
};

// A user without a custom openrouter key falls back to the shared "basic"
// default key, which is itself an openrouter key. Show those entries as the
// Basic provider so users don't see a provider they never configured.
export const toDisplayProviderId = (
  config: TlawnProviderConfigInfo | undefined,
  providerId: string
): string => {
  if (
    providerId === 'openrouter' &&
    !config?.keys?.openrouter &&
    config?.defaultKeys?.[BASIC_PROVIDER_ID]
  ) {
    return BASIC_PROVIDER_ID;
  }
  return providerId;
};

export const getModelFormValues = (
  config: TlawnProviderConfigInfo | undefined
): ModelFormValues => {
  const primary = config?.models?.find(
    (model) => model.primary && !model.channels?.length
  );
  if (!primary) {
    return {
      provider: BASIC_PROVIDER_ID,
      model: hasProviderCredential(config, BASIC_PROVIDER_ID)
        ? BASIC_DEFAULT_MODEL
        : '',
      fallbacks: [],
    };
  }
  return {
    provider: toDisplayProviderId(config, primary.provider),
    model: primary.model,
    fallbacks:
      config?.models
        ?.filter((model) => !model.primary && !model.channels?.length)
        .map((model) => ({
          provider: toDisplayProviderId(config, model.provider),
          model: model.model,
        })) ?? [],
  };
};

// --- tlonbot config utilities ---

export const normalizeTlonbotConfig = (
  raw: Partial<TlawnConfig> | null | undefined
): TlawnConfig => ({
  dmAllowlist: raw?.dmAllowlist ?? [],
  defaultAuthorizedShips: raw?.defaultAuthorizedShips ?? [],
  channelRules: Object.fromEntries(
    Object.entries(raw?.channelRules ?? {}).map(([key, rule]) => [
      key,
      {
        mode: rule?.mode === 'allowlist' ? 'allowlist' : 'open',
        allowedShips: rule?.allowedShips ?? [],
      },
    ])
  ),
  groupChannels: raw?.groupChannels ?? [],
  groupInviteAllowlist: raw?.groupInviteAllowlist ?? [],
  autoAcceptDmInvites: raw?.autoAcceptDmInvites ?? false,
  autoDiscoverChannels: raw?.autoDiscoverChannels ?? false,
});

export const buildChannelRuleDrafts = (
  config: TlawnConfig,
  providerConfig?: TlawnProviderConfigInfo
): Record<string, ChannelRuleDraft> => {
  const drafts: Record<string, ChannelRuleDraft> = {};
  Object.entries(config.channelRules || {}).forEach(([key, rule]) => {
    drafts[normalizeChannelRuleKey(key)] = {
      mode: rule.mode === 'allowlist' ? 'allowlist' : 'open',
      allowedShips: formatShipList(rule.allowedShips || []),
    };
  });
  (config.groupChannels || []).forEach((key) => {
    const channelKey = normalizeChannelRuleKey(key);
    if (!drafts[channelKey]) {
      drafts[channelKey] = {
        mode: 'open',
        allowedShips: '',
      };
    }
  });
  providerConfig?.models?.forEach((model) => {
    (model.channels || []).forEach((channel) => {
      const channelKey = normalizeChannelRuleKey(channel);
      const draft = drafts[channelKey];
      if (!draft) return;
      drafts[channelKey] = {
        ...draft,
        modelOverrideProvider: toDisplayProviderId(
          providerConfig,
          model.provider
        ),
        modelOverride: model.model,
      };
    });
  });
  return drafts;
};

export const toChatFormValues = (
  config: TlawnConfig | undefined,
  providerConfig?: TlawnProviderConfigInfo
): ChatFormValues => ({
  dmAllowlist: formatShipList(config?.dmAllowlist ?? []),
  defaultAuthorizedShips: formatShipList(config?.defaultAuthorizedShips ?? []),
  groupInviteAllowlist: formatShipList(config?.groupInviteAllowlist ?? []),
  autoAcceptDmInvites: config?.autoAcceptDmInvites ?? false,
  autoDiscoverChannels: config?.autoDiscoverChannels ?? false,
  channelRuleDrafts: config
    ? buildChannelRuleDrafts(config, providerConfig)
    : {},
});

export const buildChannelModelEntries = (
  drafts: Record<string, ChannelRuleDraft>
): TlawnChannelModelOverride[] =>
  Object.entries(drafts)
    .filter(([, rule]) => rule.modelOverrideProvider && rule.modelOverride)
    .map(([channel, rule]) => ({
      provider: rule.modelOverrideProvider || '',
      model: rule.modelOverride || '',
      channels: [normalizeChannelRuleKey(channel)],
    }));

// Merge overrides for channels this draft doesn't touch (e.g. set from
// another client) with the overrides in the draft, so a save never wipes out
// entries the user couldn't see.
export const buildMergedChannelModelEntries = (
  providerConfig: TlawnProviderConfigInfo,
  baselineDrafts: Record<string, ChannelRuleDraft>,
  nextDrafts: Record<string, ChannelRuleDraft>
): TlawnChannelModelOverride[] => {
  const affectedChannels = new Set(
    [...Object.keys(baselineDrafts), ...Object.keys(nextDrafts)].map(
      normalizeChannelRuleKey
    )
  );
  const preservedEntries =
    providerConfig.models?.flatMap((model) => {
      const preservedChannels = (model.channels ?? [])
        .map(normalizeChannelRuleKey)
        .filter((channel) => !affectedChannels.has(channel));
      if (preservedChannels.length === 0) return [];
      return [
        {
          provider: model.provider,
          model: model.model,
          channels: preservedChannels,
        },
      ];
    }) ?? [];

  return [...preservedEntries, ...buildChannelModelEntries(nextDrafts)];
};

const channelModelEntriesSignature = (
  drafts: Record<string, ChannelRuleDraft>
): string =>
  JSON.stringify(
    buildChannelModelEntries(drafts)
      .map((entry) =>
        [
          entry.provider,
          entry.model,
          ...entry.channels.map(normalizeChannelRuleKey).sort(),
        ].join('\u0000')
      )
      .sort()
  );

export const haveChannelModelEntriesChanged = (
  baseline: Record<string, ChannelRuleDraft>,
  draft: Record<string, ChannelRuleDraft>
): boolean =>
  channelModelEntriesSignature(baseline) !==
  channelModelEntriesSignature(draft);

export const buildConfigFromChatValues = (
  values: ChatFormValues
): TlawnConfig => {
  const channelRules = Object.fromEntries(
    Object.entries(values.channelRuleDrafts).map(([key, rule]) => [
      normalizeChannelRuleKey(key),
      {
        mode: rule.mode,
        allowedShips:
          rule.mode === 'allowlist' ? normalizeShipList(rule.allowedShips) : [],
      },
    ])
  );
  return {
    dmAllowlist: normalizeShipList(values.dmAllowlist),
    defaultAuthorizedShips: normalizeShipList(values.defaultAuthorizedShips),
    channelRules,
    groupChannels: Object.keys(channelRules),
    groupInviteAllowlist: normalizeShipList(values.groupInviteAllowlist),
    autoAcceptDmInvites: values.autoAcceptDmInvites,
    autoDiscoverChannels: values.autoDiscoverChannels,
  };
};

export const groupChannelEntries = (
  rawGroups: TlawnChannelGroups,
  drafts: Record<string, ChannelRuleDraft>
): ChannelListGroup[] => {
  const groups = new Map<string, ChannelListGroup>();

  Object.entries(rawGroups).forEach(([host, groupEntries]) => {
    Object.entries(groupEntries || {}).forEach(([group, entry]) => {
      const groupTitle = entry?.title || '';
      const chats = entry?.channels || {};
      Object.entries(chats).forEach(([chatId, chatTitle]) => {
        const key = `chat/${formatChannelHost(host)}/${chatId}`;
        const groupKey = `${host}/${group}`;
        if (!groups.has(groupKey)) {
          groups.set(groupKey, {
            host,
            group,
            title: groupTitle,
            channels: [],
          });
        }
        groups.get(groupKey)?.channels.push({
          key,
          label: chatTitle || chatId,
        });
      });
    });
  });

  const knownChannelKeys = new Set<string>();
  groups.forEach((group) => {
    group.channels.forEach((channel) => knownChannelKeys.add(channel.key));
  });

  // Rules can reference channels the ship no longer lists (left group, stale
  // config). Surface them anyway so the user can still disable them.
  Object.keys(drafts).forEach((rawKey) => {
    const key = normalizeChannelRuleKey(rawKey);
    if (knownChannelKeys.has(key)) return;
    const normalized = key.startsWith('chat/')
      ? key.replace(/^chat\//, '')
      : key;
    const parts = normalized.split('/');
    const parsed = parseChannelRuleKey(key);
    let group = 'unknown';
    let host = 'unknown';

    if (parsed) {
      host = formatChannelHost(parsed.host);
      const resolvedGroup = resolveGroupForChannel(
        rawGroups,
        parsed.host,
        parsed.channelId
      );
      if (resolvedGroup) group = resolvedGroup;
    }

    const hostPart = parts[0] || 'unknown';
    if (host === 'unknown') host = formatChannelHost(hostPart);
    const channelName = parts.slice(1).join('/') || normalized;
    const groupKey = `${host}/${group}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, { host, group, title: '', channels: [] });
    }

    const groupEntry = groups.get(groupKey);
    if (groupEntry && !groupEntry.channels.some((c) => c.key === key)) {
      groupEntry.channels.push({ key, label: channelName });
    }
  });

  return Array.from(groups.values())
    .sort((a, b) => {
      const hostCompare = a.host.localeCompare(b.host);
      if (hostCompare !== 0) return hostCompare;
      return a.group.localeCompare(b.group);
    })
    .map((group) => ({
      ...group,
      channels: group.channels.sort((a, b) => a.label.localeCompare(b.label)),
    }));
};

// --- validation ---

export const validateProviderKey = (
  providerId: string,
  value: string
): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return 'Enter an API key.';
  switch (providerId) {
    case 'anthropic':
      if (!trimmed.startsWith('sk-ant-') && !trimmed.startsWith('anthropic-')) {
        return 'Key must start with "sk-ant-" or "anthropic-".';
      }
      if (trimmed.length < 80) return 'Key must be at least 80 characters.';
      break;
    case 'openai':
      if (!trimmed.startsWith('sk-')) return 'Key must start with "sk-".';
      break;
    case 'openrouter':
      if (!trimmed.startsWith('sk-or-')) {
        return 'Key must start with "sk-or-".';
      }
      break;
  }
  return null;
};

export const getErrorMessage = (error: unknown): string | undefined => {
  if (!error || typeof error !== 'object' || !('message' in error)) {
    return undefined;
  }
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : undefined;
};

export const getModelDisplayName = (model: {
  id: string;
  name?: unknown;
}): string => (typeof model.name === 'string' && model.name) || model.id;
