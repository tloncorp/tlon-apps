import * as api from '@tloncorp/api';
import { useCallback, useEffect, useMemo, useState } from 'react';
import create from 'zustand';

import { BASIC_PROVIDER_ID } from './constants';
import {
  ChannelRuleDraft,
  ChatFormValues,
  ModelFormValues,
  buildConfigFromChatValues,
  buildMergedChannelModelEntries,
  getErrorMessage,
  getModelFormValues,
  haveChannelModelEntriesChanged,
  mergeChannelRules,
  normalizeChannelRuleKey,
  normalizeProviderConfig,
  normalizeTlonbotConfig,
  runApplySteps,
  toChatFormValues,
} from './helpers';
import {
  BotSettingsQueries,
  useBotSettingsMutations,
} from './useBotSettingsData';

export type BotSettingsDraftValues = {
  nickname: string;
  model: ModelFormValues;
  chat: ChatFormValues;
};

export type BotSettingsPendingFields = {
  nickname: boolean;
  modelProvider: boolean;
  model: boolean;
  fallbacks: boolean;
  dmAllowlist: boolean;
  defaultAuthorizedShips: boolean;
  groupInviteAllowlist: boolean;
  autoAcceptDmInvites: boolean;
  autoDiscoverChannels: boolean;
  channelRules: boolean;
};

const EMPTY_VALUES: BotSettingsDraftValues = {
  nickname: '',
  model: { provider: '', model: '', fallbacks: [] },
  chat: {
    dmAllowlist: '',
    defaultAuthorizedShips: '',
    groupInviteAllowlist: '',
    autoAcceptDmInvites: false,
    autoDiscoverChannels: false,
    channelRuleDrafts: {},
  },
};

const clone = (values: BotSettingsDraftValues): BotSettingsDraftValues =>
  JSON.parse(JSON.stringify(values));

// Key-order-insensitive serialization: channelRuleDrafts is a Record whose
// insertion order varies between server syncs and user edits, and plain
// JSON.stringify would report phantom changes for identical content. Arrays
// (e.g. the fallback chain) stay ordered.
const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
};

const valuesEqual = (
  left: BotSettingsDraftValues,
  right: BotSettingsDraftValues
): boolean => stableStringify(left) === stableStringify(right);

interface BotSettingsDraftStore {
  scopeKey: string;
  initialized: boolean;
  baseline: BotSettingsDraftValues;
  draft: BotSettingsDraftValues;
  syncServerValues: (scopeKey: string, values: BotSettingsDraftValues) => void;
  commitDraft: (
    updater: (draft: BotSettingsDraftValues) => BotSettingsDraftValues
  ) => void;
  discardChanges: () => void;
  commitSection: (patch: Partial<BotSettingsDraftValues>) => void;
}

// Draft state lives in a module-level store because the bot settings flow
// spans several navigator screens that must all see (and mutate) the same
// unapplied changes.
export const useBotSettingsDraftStore = create<BotSettingsDraftStore>(
  (set, get) => ({
    scopeKey: '',
    initialized: false,
    baseline: EMPTY_VALUES,
    draft: EMPTY_VALUES,
    syncServerValues: (scopeKey, values) => {
      const current = get();
      const hasLocalChanges =
        current.initialized && !valuesEqual(current.baseline, current.draft);
      // Only adopt fresh server values when the user has no unapplied edits
      // (or when we switched scope); otherwise a background refetch would
      // clobber their draft.
      if (current.scopeKey === scopeKey && hasLocalChanges) {
        return;
      }
      if (
        current.scopeKey === scopeKey &&
        current.initialized &&
        valuesEqual(current.baseline, values)
      ) {
        return;
      }
      set({
        scopeKey,
        initialized: true,
        baseline: clone(values),
        draft: clone(values),
      });
    },
    commitDraft: (updater) => {
      const current = get();
      // Updaters return fresh objects; the input clone protects the shared
      // baseline references from accidental in-place mutation.
      set({ draft: updater(clone(current.draft)) });
    },
    discardChanges: () => {
      const current = get();
      set({ draft: clone(current.baseline) });
    },
    // Advance the baseline for a section that just saved, and normalize that
    // section of the draft to match (e.g. a trimmed nickname). Only the patched
    // section is touched — a partial apply where a later section fails leaves
    // the still-unsaved sections' edits in the draft so the user can retry.
    commitSection: (patch) => {
      const current = get();
      set({
        baseline: clone({ ...current.baseline, ...patch }),
        draft: clone({ ...current.draft, ...patch }),
      });
    },
  })
);

/** Drop all draft state. Called from the logout flow so the next account
 * never sees the previous account's unapplied edits. */
export function resetBotSettingsDraft() {
  useBotSettingsDraftStore.setState({
    scopeKey: '',
    initialized: false,
    baseline: EMPTY_VALUES,
    draft: EMPTY_VALUES,
  });
}

const getPendingFields = (
  baseline: BotSettingsDraftValues,
  draft: BotSettingsDraftValues
): BotSettingsPendingFields => ({
  nickname: baseline.nickname !== draft.nickname,
  modelProvider: baseline.model.provider !== draft.model.provider,
  model: baseline.model.model !== draft.model.model,
  fallbacks:
    stableStringify(baseline.model.fallbacks) !==
    stableStringify(draft.model.fallbacks),
  dmAllowlist: baseline.chat.dmAllowlist !== draft.chat.dmAllowlist,
  defaultAuthorizedShips:
    baseline.chat.defaultAuthorizedShips !== draft.chat.defaultAuthorizedShips,
  groupInviteAllowlist:
    baseline.chat.groupInviteAllowlist !== draft.chat.groupInviteAllowlist,
  autoAcceptDmInvites:
    baseline.chat.autoAcceptDmInvites !== draft.chat.autoAcceptDmInvites,
  autoDiscoverChannels:
    baseline.chat.autoDiscoverChannels !== draft.chat.autoDiscoverChannels,
  channelRules:
    stableStringify(baseline.chat.channelRuleDrafts) !==
    stableStringify(draft.chat.channelRuleDrafts),
});

const getChangeLabels = (pending: BotSettingsPendingFields): string[] => {
  const labels: string[] = [];
  if (pending.nickname) labels.push('Nickname');
  if (pending.modelProvider) labels.push('Provider');
  if (pending.model) labels.push('Default model');
  if (pending.fallbacks) labels.push('Fallback models');
  if (pending.dmAllowlist) labels.push('DM allowlist');
  if (pending.defaultAuthorizedShips) labels.push('Authorized ships');
  if (pending.groupInviteAllowlist) labels.push('Group invites');
  if (pending.autoAcceptDmInvites) labels.push('DM invites');
  if (pending.autoDiscoverChannels) labels.push('Auto-discover');
  if (pending.channelRules) labels.push('Channel rules');
  return labels;
};

export function useBotSettingsDraft() {
  const store = useBotSettingsDraftStore();
  const pending = useMemo(
    () => getPendingFields(store.baseline, store.draft),
    [store.baseline, store.draft]
  );
  const changeLabels = useMemo(() => getChangeLabels(pending), [pending]);

  return {
    ...store,
    pending,
    changeLabels,
    changeCount: changeLabels.length,
    hasChanges: changeLabels.length > 0,
  };
}

/**
 * Push fresh server values into the draft store once the backing queries have
 * settled. Call from any screen that renders draft-backed values.
 */
export function useSyncBotSettingsDraft(queries: BotSettingsQueries) {
  const syncServerValues = useBotSettingsDraftStore(
    (state) => state.syncServerValues
  );
  const {
    ship,
    providerConfig,
    configQuery,
    nicknameQuery,
    providerConfigQuery,
  } = queries;
  const ready = Boolean(
    ship &&
    providerConfigQuery.isSuccess &&
    configQuery.isSuccess &&
    nicknameQuery.isSuccess
  );
  // syncServerValues drops a fresh server snapshot while the user has local
  // edits (so a refetch can't clobber them). If that snapshot changed an
  // untouched section and the user then discards/applies their edit, the query
  // data won't change again, so the effect wouldn't re-run and the baseline
  // would stay stale. Re-run when local edits clear so the latest server values
  // are adopted.
  const hasLocalChanges = useBotSettingsDraftStore(
    (state) => state.initialized && !valuesEqual(state.baseline, state.draft)
  );

  useEffect(() => {
    if (!ready) return;
    syncServerValues(ship, {
      nickname: nicknameQuery.data ?? '',
      model: getModelFormValues(providerConfig),
      chat: toChatFormValues(configQuery.data, providerConfig),
    });
  }, [
    ready,
    ship,
    syncServerValues,
    providerConfig,
    configQuery.data,
    nicknameQuery.data,
    hasLocalChanges,
  ]);

  return ready;
}

/**
 * Applies all pending draft changes: nickname, primary/fallback models, and
 * chat config (permissions + per-channel model overrides). Mirrors the web
 * client's apply flow — the chat-config save restarts the tlawn gateway.
 */
export function useApplyBotSettings(queries: BotSettingsQueries) {
  const draft = useBotSettingsDraft();
  const mutations = useBotSettingsMutations();
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const applyChanges = useCallback(async () => {
    // Never apply a draft scoped to a different ship: the module-level store can
    // still hold a previous account's unapplied edits (see resetBotSettingsDraft,
    // wired into logout) before this account's queries have synced.
    if (
      !queries.ship ||
      draft.scopeKey !== queries.ship ||
      !draft.hasChanges ||
      applying
    ) {
      return;
    }
    const nextValues = draft.draft;
    // Screen-level validation can be bypassed (hardware back, drawer
    // navigation), so re-check the invariants that would silently persist a
    // broken config. The primary model needs a provider, and a non-basic
    // provider also needs a concrete model. Only validate the primary when it's
    // actually dirty — a fallbacks-only change sends the server's primary.
    if (draft.pending.modelProvider || draft.pending.model) {
      if (!nextValues.model.provider) {
        setApplyError(
          'Select a provider for the default model before applying.'
        );
        return;
      }
      if (
        nextValues.model.provider !== BASIC_PROVIDER_ID &&
        !nextValues.model.model
      ) {
        setApplyError('Select a default model before applying.');
        return;
      }
    }
    if (draft.pending.channelRules) {
      // A model override needs a provider, and a non-basic provider also needs a
      // model (Basic has no model picker — it's pinned on save). A provider-less
      // row with a stale model, or a non-basic provider with no model, is
      // dropped by the merge path, so reject it here rather than marking it
      // applied.
      const incompleteOverride = Object.values(
        nextValues.chat.channelRuleDrafts
      ).some(
        (rule) =>
          rule.modelOverrideProvider !== BASIC_PROVIDER_ID &&
          Boolean(rule.modelOverrideProvider) !== Boolean(rule.modelOverride)
      );
      if (incompleteOverride) {
        setApplyError('Select a model for each channel with a custom model.');
        return;
      }
    }
    setApplying(true);
    setApplyError(null);
    try {
      // Refetch the provider config at most once and reuse it for both the
      // model save and the channel-override merge; abort if it fails rather than
      // writing/merging against stale data.
      let freshProviderConfig: api.TlawnProviderConfigInfo | null = null;
      const getFreshProviderConfig = async () => {
        if (freshProviderConfig) return freshProviderConfig;
        const refetched = await queries.providerConfigQuery.refetch();
        if (!refetched.isSuccess || !refetched.data) {
          throw new Error(
            'Could not load the latest model configuration. Please try again.'
          );
        }
        freshProviderConfig = refetched.data;
        return freshProviderConfig;
      };

      // Each section commits to the baseline as soon as its write lands (see
      // runApplySteps), so a mid-sequence failure leaves only the unwritten
      // sections pending instead of re-reporting (and re-writing) work that
      // already succeeded.
      const steps: {
        run: () => Promise<Partial<BotSettingsDraftValues> | void>;
        commit: Partial<BotSettingsDraftValues>;
      }[] = [];

      if (draft.pending.nickname) {
        const nickname = nextValues.nickname.trim();
        steps.push({
          run: async () => {
            await mutations.updateNickname.mutateAsync(nickname);
          },
          commit: { nickname },
        });
      }
      if (
        draft.pending.modelProvider ||
        draft.pending.model ||
        draft.pending.fallbacks
      ) {
        steps.push({
          // Merge against the latest server model config so editing only the
          // primary model (or only the fallbacks) doesn't write the other's
          // stale value back and clobber a concurrent change.
          run: async () => {
            const serverModel = getModelFormValues(
              await getFreshProviderConfig()
            );
            const primaryDirty =
              draft.pending.modelProvider || draft.pending.model;
            const saved = await mutations.savePrimaryModel.mutateAsync({
              provider: primaryDirty
                ? nextValues.model.provider
                : serverModel.provider,
              model: primaryDirty ? nextValues.model.model : serverModel.model,
              fallbacks: draft.pending.fallbacks
                ? nextValues.model.fallbacks
                : serverModel.fallbacks,
            });
            const savedProviderConfig = normalizeProviderConfig(saved);
            // The save returns the full post-save provider config; adopt it as
            // the cached fresh config so the later channelModels merge (in the
            // chat step of this same apply) works from the newest snapshot —
            // an override another client added while this ran isn't dropped.
            freshProviderConfig = savedProviderConfig;
            // Commit what the server actually stored (merged untouched fields,
            // Basic pinned to its default) rather than the draft snapshot, so a
            // later failing step doesn't leave a stale model shown.
            return {
              model: getModelFormValues(savedProviderConfig),
            };
          },
          commit: { model: nextValues.model },
        });
      }
      const chatConfigDirty =
        draft.pending.dmAllowlist ||
        draft.pending.defaultAuthorizedShips ||
        draft.pending.groupInviteAllowlist ||
        draft.pending.autoAcceptDmInvites ||
        draft.pending.autoDiscoverChannels ||
        draft.pending.channelRules;
      const chatConfigStep = async () => {
        const baselineDrafts = draft.baseline.chat.channelRuleDrafts;
        const nextDrafts = nextValues.chat.channelRuleDrafts;
        const allChannelKeys = [
          ...new Set([
            ...Object.keys(baselineDrafts),
            ...Object.keys(nextDrafts),
          ]),
        ];

        // Per-channel model-override signature. Basic has no model picker (its
        // model is pinned on save), so a Basic override is real even with an
        // empty model — sign it distinctly so a to/from-Basic change registers
        // instead of collapsing to "no override".
        const overrideSig = (rule?: ChannelRuleDraft) => {
          const provider = rule?.modelOverrideProvider;
          if (!provider) return '';
          if (provider === BASIC_PROVIDER_ID) return provider;
          return rule?.modelOverride ? `${provider} ${rule.modelOverride}` : '';
        };
        // Enabling/disabling a channel also resets its override: a channel
        // enabled with no override must clear any (hidden) server-side override,
        // and a disabled channel drops its override.
        const monitoringToggled = (key: string) =>
          Boolean(baselineDrafts[key]) !== Boolean(nextDrafts[key]);
        const dirtyChannelKeys = new Set(
          allChannelKeys.filter(
            (key) =>
              overrideSig(baselineDrafts[key]) !==
                overrideSig(nextDrafts[key]) || monitoringToggled(key)
          )
        );
        const channelModelsChanged = haveChannelModelEntriesChanged(
          baselineDrafts,
          nextDrafts
        );
        const hasMonitoringToggle = allChannelKeys.some(monitoringToggled);

        // Fresh provider config is needed to (a) merge overrides for channels
        // this draft didn't touch and (b) detect a server-side override on a
        // channel the user just toggled (another client may have added it after
        // we hydrated). Both need up-to-date data, so refetch when either
        // applies — deciding the hidden-override case from the stale cache could
        // miss a newly-added override and leave it hidden.
        const providerConfigForMerge =
          channelModelsChanged || hasMonitoringToggle
            ? await getFreshProviderConfig()
            : queries.providerConfig;

        // A monitoring toggle on a channel that has a server-side override must
        // still send channelModels (to clear/reset it) even when no draft
        // override field changed.
        const serverOverrideChannels = new Set(
          (providerConfigForMerge.models ?? []).flatMap((model) =>
            (model.channels ?? []).map(normalizeChannelRuleKey)
          )
        );
        const clearsHiddenOverride = allChannelKeys.some(
          (key) =>
            monitoringToggled(key) &&
            serverOverrideChannels.has(normalizeChannelRuleKey(key))
        );
        const sendChannelModels = channelModelsChanged || clearsHiddenOverride;

        // The chat-config PUT is replacement-style: Solaris rebuilds the whole
        // config from the body and resets any omitted field to its default (and
        // derives groupChannels from channelRules keys). So we always send the
        // COMPLETE config. Refetch the latest server state and take each field
        // the user didn't change from it, so a concurrent edit to an untouched
        // field isn't clobbered.
        const refetched = await queries.configQuery.refetch();
        if (!refetched.isSuccess || !refetched.data) {
          throw new Error(
            'Could not load the latest chat configuration. Please try again.'
          );
        }
        const server = refetched.data;
        const draftConfig = buildConfigFromChatValues(nextValues.chat);

        // Merge channelRules per-channel: start from the server rules and overlay
        // only the channels whose ACCESS rule the user actually changed, so a
        // concurrent edit to another channel survives. Sign the draft's access
        // intent (monitoring + mode + allowlist), which — unlike diffing the
        // materialized rules — excludes model-override-only edits (they travel
        // via channelModels).
        const nextRules = draftConfig.channelRules;
        const ruleSig = (rule?: ChannelRuleDraft) => {
          if (!rule) return '';
          return `${rule.mode}:${rule.allowedShips}`;
        };
        const dirtyRuleKeys = allChannelKeys.filter(
          (key) => ruleSig(baselineDrafts[key]) !== ruleSig(nextDrafts[key])
        );
        const channelRules = mergeChannelRules(
          server.channelRules,
          nextRules,
          dirtyRuleKeys,
          server.groupChannels
        );

        const config: Partial<typeof draftConfig> = {
          dmAllowlist: draft.pending.dmAllowlist
            ? draftConfig.dmAllowlist
            : server.dmAllowlist,
          defaultAuthorizedShips: draft.pending.defaultAuthorizedShips
            ? draftConfig.defaultAuthorizedShips
            : server.defaultAuthorizedShips,
          groupInviteAllowlist: draft.pending.groupInviteAllowlist
            ? draftConfig.groupInviteAllowlist
            : server.groupInviteAllowlist,
          autoAcceptDmInvites: draft.pending.autoAcceptDmInvites
            ? draftConfig.autoAcceptDmInvites
            : server.autoAcceptDmInvites,
          autoDiscoverChannels: draft.pending.autoDiscoverChannels
            ? draftConfig.autoDiscoverChannels
            : server.autoDiscoverChannels,
          channelRules,
          // Solaris derives groupChannels from channelRules keys and ignores this
          // field; send the mirrored value so the payload is self-consistent.
          groupChannels: Object.keys(channelRules),
        };

        // Pass just the dirty channels to the override merge so it preserves the
        // refetched server value for every untouched channel; a dirty channel
        // with no override clears any (hidden) server-side override for it.
        const pickDirty = (drafts: Record<string, ChannelRuleDraft>) =>
          Object.fromEntries(
            Object.entries(drafts).filter(([key]) => dirtyChannelKeys.has(key))
          );

        const result = await api.setTlawnChatConfig(queries.ship, {
          config,
          ...(sendChannelModels
            ? {
                channelModels: {
                  models: buildMergedChannelModelEntries(
                    providerConfigForMerge,
                    pickDirty(baselineDrafts),
                    pickDirty(nextDrafts)
                  ),
                },
              }
            : {}),
        });

        // Normalize like configQuery does so the cache and the committed
        // baseline match what a later refetch would yield.
        const savedConfig = normalizeTlonbotConfig(result.config);
        const savedProviderConfig = normalizeProviderConfig(
          result.providerConfig
        );
        mutations.queryClient.setQueryData(
          ['tlonbot', 'settings', queries.ship],
          savedConfig
        );
        mutations.setProviderConfig(result.providerConfig);
        // Commit the server-accepted chat state (which can include channels
        // another client added and the merge preserved) rather than the draft
        // snapshot, so those aren't hidden until the next remount/refetch.
        return {
          chat: toChatFormValues(savedConfig, savedProviderConfig),
        };
      };
      if (chatConfigDirty) {
        steps.push({ run: chatConfigStep, commit: { chat: nextValues.chat } });
      }

      await runApplySteps(steps, draft.commitSection);
      // The gateway restarts after a chat-config save; refresh readiness so
      // the status badge reflects it.
      queries.readyQuery.refetch();
    } catch (error) {
      setApplyError(getErrorMessage(error) ?? 'Failed to apply changes.');
    } finally {
      setApplying(false);
    }
  }, [queries, draft, mutations, applying]);

  return { ...draft, applying, applyError, setApplyError, applyChanges };
}
