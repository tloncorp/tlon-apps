import { nestToFlag } from '@tloncorp/api';
import type {
  TlawnChannelGroups,
  TlawnChannelModelOverride,
  TlawnConfig,
  TlawnProviderConfigInfo,
} from '@tloncorp/api';
import { desig, preSig } from '@tloncorp/api/lib/urbit';

import { BASIC_DEFAULT_MODEL, BASIC_PROVIDER_ID } from './constants';

export type ChannelRuleDraft = {
  mode: 'open' | 'allowlist';
  allowedShips: string;
  modelOverrideProvider?: string;
  modelOverride?: string;
  // True for a channel presented as "following defaultAuthorizedShips" rather
  // than a custom list. `allowedShips` holds the defaults as a display snapshot;
  // on save the current defaults are materialized into the rule's allowedShips
  // (Solaris can't store a follow-the-defaults rule — see
  // buildConfigFromChatValues). Cleared once the user edits the rule explicitly
  // (see setRule in BotChannelRuleSettingsScreen).
  inheritsDefaultShips?: boolean;
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

// The bot monitors chat, heap, and diary channels (see the OpenClaw firehose),
// each keyed by its own nest prefix. Preserve the prefix so a heap/diary rule
// isn't rewritten as a chat nest (which would drop the real rule server-side).
const CHANNEL_APPS = ['chat', 'heap', 'diary'];
const DEFAULT_CHANNEL_APP = 'chat';

export const formatChannelHost = (host: string): string => preSig(host);

export const parseChannelRuleKey = (
  key: string
): { app: string; host: string; channelId: string } | null => {
  const trimmed = key.trim();
  // Channel keys are nests (app/~host/channelId). Strip a known app prefix with
  // the shared helper; keys without one are already host/channelId (app: chat).
  const maybeApp = trimmed.split('/')[0];
  const hasAppPrefix = CHANNEL_APPS.includes(maybeApp);
  const app = hasAppPrefix ? maybeApp : DEFAULT_CHANNEL_APP;
  const flag = hasAppPrefix ? nestToFlag(trimmed)[1] : trimmed;
  const [host, ...rest] = flag.split('/');
  const channelId = rest.join('/');
  if (!host || !channelId) return null;
  return { app, host, channelId };
};

export const resolveGroupForChannel = (
  groups: TlawnChannelGroups,
  host: string,
  channelId: string
): string | null => {
  const hostKey = formatChannelHost(host);
  const hostGroups = groups[hostKey] || groups[desig(hostKey)] || {};
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
  const hostGroups = groups[hostKey] || groups[desig(hostKey)] || {};
  return Object.prototype.hasOwnProperty.call(hostGroups, group);
};

export const normalizeChannelRuleKey = (key: string): string => {
  const parsed = parseChannelRuleKey(key);
  if (!parsed) return key;
  return `${parsed.app}/${formatChannelHost(parsed.host)}/${parsed.channelId}`;
};

export const resolveGroupFull = (
  groups: TlawnChannelGroups,
  host: string,
  groupName: string,
  entryKey: string
): string | null => {
  const hostKey = formatChannelHost(host);
  // Group flags are slash-delimited (~host/name), matching what the cordon/join
  // backend expects — not the %-delimited form.
  if (groupName !== 'unknown') return `${hostKey}/${groupName}`;
  const parsed = parseChannelRuleKey(entryKey);
  if (!parsed) return null;
  const resolvedGroup = resolveGroupForChannel(
    groups,
    formatChannelHost(parsed.host),
    parsed.channelId
  );
  return resolvedGroup
    ? `${formatChannelHost(parsed.host)}/${resolvedGroup}`
    : null;
};

// --- ship list utilities ---

export const normalizeShip = (value: string): string | null => {
  const stripped = value.trim().replace(/^[@~]+/, '');
  return stripped ? preSig(stripped) : null;
};

export const normalizeMoonName = (moon: string, ship: string): string => {
  const strippedShip = desig(ship);
  const stripped = moon.trim().replace(/^[@~]+/, '');
  const suffix = `-${strippedShip}`;
  const full = stripped.endsWith(suffix) ? stripped : `${stripped}${suffix}`;
  return preSig(full);
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

// Never render a stored key in full. Show a redacted summary (mask + last four
// characters) so the settings screens can indicate a key is set without
// exposing the secret in clear text.
export const safeKeySummary = (
  config: TlawnProviderConfigInfo | undefined,
  providerId: string
): string => {
  if (providerId === BASIC_PROVIDER_ID) return 'Included';
  const key = config?.keys?.[providerId];
  if (!key) return 'Not set';
  return key.length > 4 ? `••••${key.slice(-4)}` : '••••';
};

// Basic is now persisted as its own backend provider (see toBackendModel), so a
// stored `basic` entry displays as Basic directly. This heuristic additionally
// covers legacy configs written before that: an openrouter entry running the
// shared hosted default model (`BASIC_DEFAULT_MODEL`) with no custom openrouter
// key is the Basic default key, so show it as Basic. It must be gated on the
// model — a custom openrouter model (primary, fallback, or channel override)
// must NOT be relabeled Basic, or a later save (toBackendModel) would pin it to
// minimax-m3 and silently rewrite the user's real model.
export const toDisplayProviderId = (
  config: TlawnProviderConfigInfo | undefined,
  providerId: string,
  model?: string
): string => {
  if (
    providerId === 'openrouter' &&
    model === BASIC_DEFAULT_MODEL &&
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
    provider: toDisplayProviderId(config, primary.provider, primary.model),
    model: primary.model,
    fallbacks:
      config?.models
        ?.filter((model) => !model.primary && !model.channels?.length)
        .map((model) => ({
          provider: toDisplayProviderId(config, model.provider, model.model),
          model: model.model,
        })) ?? [],
  };
};

// --- tlonbot config utilities ---

// Solaris stores channel authorization as `allowlist | open` and normalizes any
// other mode value to `open` — dropping the restriction (see
// normalizeChannelRules in ylem's Solaris/API/Tlawn.hs). So the wire vocabulary
// is `allowlist | open`, matching the UI's own draft modes: toBackendMode is a
// straight pass-through, kept as the single wire-mode boundary. toDraftMode
// stays tolerant of anything that isn't `open` (legacy `restricted`, unknown
// values) so an old config reads as an allowlist rather than silently as open.
export const toDraftMode = (mode: string | undefined): 'open' | 'allowlist' =>
  mode === 'open' ? 'open' : 'allowlist';

export const toBackendMode = (mode: 'open' | 'allowlist'): string => mode;

export const normalizeTlonbotConfig = (
  raw: Partial<TlawnConfig> | null | undefined
): TlawnConfig => {
  const defaultAuthorizedShips = raw?.defaultAuthorizedShips ?? [];
  return {
    dmAllowlist: raw?.dmAllowlist ?? [],
    defaultAuthorizedShips,
    channelRules: Object.fromEntries(
      Object.entries(raw?.channelRules ?? {}).map(([key, rule]) => {
        const mode = toBackendMode(toDraftMode(rule?.mode));
        // Preserve an omitted allowedShips (undefined) rather than materializing
        // it: an allowlist rule without allowedShips inherits
        // defaultAuthorizedShips, and buildChannelRuleDrafts needs that
        // distinction to keep the rule following the defaults. An explicit []
        // (block-all) is kept as-is.
        return [key, { mode, allowedShips: rule?.allowedShips }];
      })
    ),
    groupChannels: raw?.groupChannels ?? [],
    groupInviteAllowlist: raw?.groupInviteAllowlist ?? [],
    autoAcceptDmInvites: raw?.autoAcceptDmInvites ?? false,
    autoDiscoverChannels: raw?.autoDiscoverChannels ?? false,
  };
};

// An allowlist channel that follows defaultAuthorizedShips. The allowlist is
// prefilled for display, but the flag makes the save path omit allowedShips so
// the channel keeps inheriting the (current and future) defaults.
const inheritedDraft = (
  defaultAuthorizedShips: string[]
): ChannelRuleDraft => ({
  mode: 'allowlist',
  allowedShips: formatShipList(defaultAuthorizedShips || []),
  inheritsDefaultShips: true,
});

export const buildChannelRuleDrafts = (
  config: TlawnConfig,
  providerConfig?: TlawnProviderConfigInfo
): Record<string, ChannelRuleDraft> => {
  const drafts: Record<string, ChannelRuleDraft> = {};
  Object.entries(config.channelRules || {}).forEach(([key, rule]) => {
    // An allowlist rule with no explicit allowedShips inherits
    // defaultAuthorizedShips on the backend; flag it so a save keeps it
    // following the defaults instead of freezing the current list.
    drafts[normalizeChannelRuleKey(key)] =
      rule.mode === 'allowlist' && rule.allowedShips === undefined
        ? inheritedDraft(config.defaultAuthorizedShips)
        : {
            mode: toDraftMode(rule.mode),
            allowedShips: formatShipList(rule.allowedShips || []),
          };
  });
  (config.groupChannels || []).forEach((key) => {
    const channelKey = normalizeChannelRuleKey(key);
    if (!drafts[channelKey]) {
      // No explicit rule at all — same inherited-allowlist default.
      drafts[channelKey] = inheritedDraft(config.defaultAuthorizedShips);
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
          model.provider,
          model.model
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

// Normalize a picked (provider, model) pair for persistence. "basic" is a real
// backend provider — Solaris provisions the shared hosted default key when a
// config selects it (tloncorp/ylem#3180) — so it is written as-is, not remapped
// to openrouter. It has no model picker, so pin its model to the fixed default
// (matching the backend's `basicDefaultModel`). Persisting `basic` explicitly
// keeps it distinct from openrouter even when the user also has their own
// openrouter key; toDisplayProviderId still reads legacy openrouter/minimax
// configs as Basic for backward compatibility.
export const toBackendModel = (
  provider: string,
  model: string
): { provider: string; model: string } => ({
  provider,
  model: provider === BASIC_PROVIDER_ID ? BASIC_DEFAULT_MODEL : model,
});

export const buildChannelModelEntries = (
  drafts: Record<string, ChannelRuleDraft>
): TlawnChannelModelOverride[] =>
  Object.entries(drafts)
    // A complete override needs a provider and a model — except Basic, which has
    // no model picker (toBackendModel pins it to the fixed default), so a Basic
    // override with an empty model is still valid and must not be dropped.
    .filter(
      ([, rule]) =>
        rule.modelOverrideProvider &&
        (rule.modelOverride || rule.modelOverrideProvider === BASIC_PROVIDER_ID)
    )
    .map(([channel, rule]) => ({
      ...toBackendModel(
        rule.modelOverrideProvider || '',
        rule.modelOverride || ''
      ),
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
  // Every monitored channel must have an explicit channelRules entry: Solaris
  // derives groupChannels from `Map.keys channelRules` and ignores the payload's
  // groupChannels, so a channel with no rule is not monitored. It also requires
  // allowedShips on every rule. So materialize each channel — an inherited
  // channel snapshots the CURRENT defaultAuthorizedShips into its allowedShips
  // (it can't "follow" the defaults through this endpoint); an explicit allowlist
  // keeps its own list; an open channel sends an empty list.
  const channelRules = Object.fromEntries(
    Object.entries(values.channelRuleDrafts).map(([key, rule]) => [
      normalizeChannelRuleKey(key),
      {
        mode: toBackendMode(rule.mode),
        allowedShips:
          rule.mode === 'allowlist'
            ? normalizeShipList(
                rule.inheritsDefaultShips
                  ? values.defaultAuthorizedShips
                  : rule.allowedShips
              )
            : [],
      },
    ])
  );
  // Mirror Solaris (groupChannels = channelRules keys) so a channel is monitored
  // iff it has a rule.
  const groupChannels = Object.keys(channelRules);
  return {
    dmAllowlist: normalizeShipList(values.dmAllowlist),
    defaultAuthorizedShips: normalizeShipList(values.defaultAuthorizedShips),
    channelRules,
    groupChannels,
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
