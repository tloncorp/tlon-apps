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
            // Commit what the server actually stored (merged untouched fields,
            // Basic pinned to its default) rather than the draft snapshot, so a
            // later failing step doesn't leave a stale model shown.
            return {
              model: getModelFormValues(normalizeProviderConfig(saved)),
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
        const channelModelsChanged = haveChannelModelEntriesChanged(
          draft.baseline.chat.channelRuleDrafts,
          nextValues.chat.channelRuleDrafts
        );

        // The override merge preserves entries for channels this draft never
        // touched, so it must run against fresh server data (reused refetch,
        // aborts on failure).
        const providerConfigForMerge = channelModelsChanged
          ? await getFreshProviderConfig()
          : queries.providerConfig;

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
        // only the channels the user actually changed (a removed channel is
        // deleted), so a concurrent edit to another channel survives. Diffing the
        // built payloads keeps model-override-only edits (which also flip
        // pending.channelRules, but travel via channelModels) out of this map.
        const baselineRules = buildConfigFromChatValues(
          draft.baseline.chat
        ).channelRules;
        const nextRules = draftConfig.channelRules;
        const dirtyRuleKeys = [
          ...new Set([
            ...Object.keys(baselineRules),
            ...Object.keys(nextRules),
          ]),
        ].filter(
          (key) =>
            stableStringify(baselineRules[key]) !==
            stableStringify(nextRules[key])
        );
        const channelRules = mergeChannelRules(
          server.channelRules,
          nextRules,
          dirtyRuleKeys
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

        // Only rewrite model overrides for channels whose override actually
        // changed. Passing just the dirty channels lets the merge preserve the
        // refetched server value for every other (including visible but
        // untouched) channel instead of the stale draft snapshot.
        const overrideSig = (rule?: ChannelRuleDraft) =>
          rule?.modelOverrideProvider && rule?.modelOverride
            ? `${rule.modelOverrideProvider} ${rule.modelOverride}`
            : '';
        const baselineChannelDrafts = draft.baseline.chat.channelRuleDrafts;
        const nextChannelDrafts = nextValues.chat.channelRuleDrafts;
        const dirtyChannelKeys = new Set(
          [
            ...Object.keys(baselineChannelDrafts),
            ...Object.keys(nextChannelDrafts),
          ].filter(
            (key) =>
              overrideSig(baselineChannelDrafts[key]) !==
              overrideSig(nextChannelDrafts[key])
          )
        );
        const pickDirty = (drafts: Record<string, ChannelRuleDraft>) =>
          Object.fromEntries(
            Object.entries(drafts).filter(([key]) => dirtyChannelKeys.has(key))
          );

        const result = await api.setTlawnChatConfig(queries.ship, {
          config,
          ...(channelModelsChanged
            ? {
                channelModels: {
                  models: buildMergedChannelModelEntries(
                    providerConfigForMerge,
                    pickDirty(baselineChannelDrafts),
                    pickDirty(nextChannelDrafts)
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
