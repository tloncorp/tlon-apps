import * as api from '@tloncorp/api';
import { useCallback, useEffect, useMemo, useState } from 'react';
import create from 'zustand';

import { BASIC_PROVIDER_ID } from './constants';
import {
  ChatFormValues,
  ModelFormValues,
  buildConfigFromChatValues,
  buildMergedChannelModelEntries,
  getErrorMessage,
  getModelFormValues,
  haveChannelModelEntriesChanged,
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
      if (draft.pending.nickname) {
        await mutations.updateNickname.mutateAsync(nextValues.nickname.trim());
      }
      if (
        draft.pending.modelProvider ||
        draft.pending.model ||
        draft.pending.fallbacks
      ) {
        await mutations.savePrimaryModel.mutateAsync(nextValues.model);
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

        // Overrides are merged against the latest provider config so entries
        // for channels this draft never touched are preserved.
        // The merge preserves per-channel overrides for channels this draft
        // never touched, so it must run against fresh server data. If the
        // refetch fails, abort rather than merging against the stale cache —
        // that could silently drop an override another client just added.
        let providerConfigForMerge = queries.providerConfig;
        if (channelModelsChanged) {
          const refetched = await queries.providerConfigQuery.refetch();
          if (!refetched.data) {
            throw new Error(
              'Could not load the latest model configuration. Please try again.'
            );
          }
          providerConfigForMerge = refetched.data;
        }

        const result = await api.setTlawnChatConfig(queries.ship, {
          config: buildConfigFromChatValues(nextValues.chat),
          ...(channelModelsChanged
            ? {
                channelModels: {
                  models: buildMergedChannelModelEntries(
                    providerConfigForMerge,
                    draft.baseline.chat.channelRuleDrafts,
                    nextValues.chat.channelRuleDrafts
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
