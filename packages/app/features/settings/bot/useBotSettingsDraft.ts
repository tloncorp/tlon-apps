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
  normalizeChannelRuleKey,
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
  markApplied: (values?: BotSettingsDraftValues) => void;
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
    markApplied: (values) => {
      const current = get();
      const nextBaseline = clone(values ?? current.draft);
      set({ baseline: nextBaseline, draft: clone(nextBaseline) });
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
    if (!queries.ship || !draft.hasChanges || applying) return;
    const nextValues = draft.draft;
    // Screen-level validation can be bypassed (hardware back, drawer
    // navigation), so re-check the invariants that would silently persist a
    // broken config: a non-basic provider needs a concrete model, for both the
    // default model and any per-channel override.
    if (
      (draft.pending.modelProvider ||
        draft.pending.model ||
        draft.pending.fallbacks) &&
      nextValues.model.provider !== BASIC_PROVIDER_ID &&
      !nextValues.model.model
    ) {
      setApplyError('Select a default model before applying.');
      return;
    }
    if (draft.pending.channelRules) {
      // A model override needs both a provider and a model; a row with only one
      // (including a Basic provider with no model) is silently dropped by the
      // merge path, so reject it here rather than marking it applied.
      const incompleteOverride = Object.values(
        nextValues.chat.channelRuleDrafts
      ).some(
        (rule) =>
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

      if (draft.pending.nickname) {
        await mutations.updateNickname.mutateAsync(nextValues.nickname.trim());
      }
      if (
        draft.pending.modelProvider ||
        draft.pending.model ||
        draft.pending.fallbacks
      ) {
        // Merge against the latest server model config so editing only the
        // primary model (or only the fallbacks) doesn't write the other's stale
        // value back and clobber a concurrent change.
        const serverModel = getModelFormValues(await getFreshProviderConfig());
        const primaryDirty = draft.pending.modelProvider || draft.pending.model;
        await mutations.savePrimaryModel.mutateAsync({
          provider: primaryDirty
            ? nextValues.model.provider
            : serverModel.provider,
          model: primaryDirty ? nextValues.model.model : serverModel.model,
          fallbacks: draft.pending.fallbacks
            ? nextValues.model.fallbacks
            : serverModel.fallbacks,
        });
      }
      if (
        draft.pending.dmAllowlist ||
        draft.pending.defaultAuthorizedShips ||
        draft.pending.groupInviteAllowlist ||
        draft.pending.autoAcceptDmInvites ||
        draft.pending.autoDiscoverChannels ||
        draft.pending.channelRules
      ) {
        const channelModelsChanged = haveChannelModelEntriesChanged(
          draft.baseline.chat.channelRuleDrafts,
          nextValues.chat.channelRuleDrafts
        );

        // The merge preserves overrides for channels this draft never touched,
        // so it must run against fresh server data (reused refetch, aborts on
        // failure).
        const providerConfigForMerge = channelModelsChanged
          ? await getFreshProviderConfig()
          : queries.providerConfig;

        // Send only the fields the user actually changed. The backend merges
        // config partially, so writing the whole payload would clobber a
        // concurrent change to a field this draft never touched.
        const fullConfig = buildConfigFromChatValues(nextValues.chat);
        // pending.channelRules is also true for model-override-only edits (the
        // override fields live in channelRuleDrafts), and a real rule edit must
        // not resend the whole map (that clobbers a concurrent change to another
        // channel). Diff the built rule payloads per channel; override moves go
        // via channelModels, not here.
        const baselineRules = buildConfigFromChatValues(
          draft.baseline.chat
        ).channelRules;
        const nextRules = fullConfig.channelRules;
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
        const config: Partial<typeof fullConfig> = {};
        if (draft.pending.dmAllowlist) {
          config.dmAllowlist = fullConfig.dmAllowlist;
        }
        if (draft.pending.defaultAuthorizedShips) {
          config.defaultAuthorizedShips = fullConfig.defaultAuthorizedShips;
        }
        if (draft.pending.groupInviteAllowlist) {
          config.groupInviteAllowlist = fullConfig.groupInviteAllowlist;
        }
        if (draft.pending.autoAcceptDmInvites) {
          config.autoAcceptDmInvites = fullConfig.autoAcceptDmInvites;
        }
        if (draft.pending.autoDiscoverChannels) {
          config.autoDiscoverChannels = fullConfig.autoDiscoverChannels;
        }
        if (dirtyRuleKeys.length > 0) {
          // Merge just the changed channels onto the latest server rules so a
          // concurrent edit to an untouched channel isn't overwritten by our
          // stale full map.
          const refetchedSettings = await queries.configQuery.refetch();
          if (!refetchedSettings.isSuccess || !refetchedSettings.data) {
            throw new Error(
              'Could not load the latest channel rules. Please try again.'
            );
          }
          // Server data can carry legacy un-normalized keys (zod/general);
          // normalize them so the dirty-key updates/deletes below hit the same
          // entries instead of leaving a stale duplicate behind.
          const mergedRules: typeof nextRules = {};
          Object.entries(refetchedSettings.data.channelRules ?? {}).forEach(
            ([key, serverRule]) => {
              mergedRules[normalizeChannelRuleKey(key)] = serverRule;
            }
          );
          const removedRuleKeys = new Set<string>();
          dirtyRuleKeys.forEach((key) => {
            if (nextRules[key] !== undefined) {
              mergedRules[key] = nextRules[key];
            } else {
              delete mergedRules[key];
              removedRuleKeys.add(key);
            }
          });
          // groupChannels can list monitored channels that have no explicit
          // rule (fully inherited); keep them so the bot doesn't stop
          // monitoring them, dropping only the channels this draft disabled.
          const mergedGroupChannels = new Set(Object.keys(mergedRules));
          (refetchedSettings.data.groupChannels ?? []).forEach((key) => {
            const normalized = normalizeChannelRuleKey(key);
            if (!removedRuleKeys.has(normalized)) {
              mergedGroupChannels.add(normalized);
            }
          });
          config.channelRules = mergedRules;
          config.groupChannels = [...mergedGroupChannels];
        }

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

        mutations.queryClient.setQueryData(
          ['tlonbot', 'settings', queries.ship],
          result.config
        );
        mutations.setProviderConfig(result.providerConfig);
      }
      draft.markApplied({
        ...nextValues,
        nickname: nextValues.nickname.trim(),
      });
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
