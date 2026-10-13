import create from 'zustand';

// Type-only, so this module carries no runtime dependency on the hosting API
// (and through it expo-modules-core) — the draft store is plain state and
// stays importable on its own.
import type { BotSettingsPendingFields } from './botSettingsDraftHelpers';
import type { ChatFormValues, ModelFormValues } from './helpers';

export type BotSettingsDraftValues = {
  nickname: string;
  model: ModelFormValues;
  chat: ChatFormValues;
};

export const EMPTY_VALUES: BotSettingsDraftValues = {
  nickname: '',
  model: { provider: '', model: '', zdr: false, fallbacks: [] },
  chat: {
    dmAllowlist: '',
    defaultAuthorizedShips: '',
    groupInviteAllowlist: '',
    autoAcceptDmInvites: false,
    autoDiscoverChannels: false,
    channelRuleDrafts: {},
  },
};

export const clone = (values: BotSettingsDraftValues): BotSettingsDraftValues =>
  JSON.parse(JSON.stringify(values));

// Key-order-insensitive serialization: channelRuleDrafts is a Record whose
// insertion order varies between server syncs and user edits, and plain
// JSON.stringify would report phantom changes for identical content. Arrays
// (e.g. the fallback chain) stay ordered.
export const stableStringify = (value: unknown): string => {
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

export const valuesEqual = (
  left: BotSettingsDraftValues,
  right: BotSettingsDraftValues
): boolean => stableStringify(left) === stableStringify(right);

/**
 * The one definition of which fields count as changed. The Apply bar labels
 * these and the store guards unapplied edits against a background refetch with
 * them; deriving both from here is what keeps a newly added setting from
 * protecting a draft the Apply bar calls unchanged, or the reverse.
 */
export const getPendingFields = (
  baseline: BotSettingsDraftValues,
  draft: BotSettingsDraftValues
): BotSettingsPendingFields => ({
  nickname: baseline.nickname !== draft.nickname,
  modelProvider: baseline.model.provider !== draft.model.provider,
  model: baseline.model.model !== draft.model.model,
  zdr: baseline.model.zdr !== draft.model.zdr,
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

export const hasPendingChanges = (
  baseline: BotSettingsDraftValues,
  draft: BotSettingsDraftValues
): boolean => Object.values(getPendingFields(baseline, draft)).some(Boolean);

interface BotSettingsDraftStore {
  scopeKey: string;
  initialized: boolean;
  baseline: BotSettingsDraftValues;
  draft: BotSettingsDraftValues;
  // Apply state is shared, not per-screen: several surfaces render an apply
  // bar over the same draft (the Settings tab and whichever bot screen is
  // open), and a second bar that still read applying=false would let the user
  // start a concurrent apply and restart the gateway twice.
  applying: boolean;
  applyError: string | null;
  setApplying: (applying: boolean) => void;
  setApplyError: (error: string | null) => void;
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
    applying: false,
    applyError: null,
    setApplying: (applying) => set({ applying }),
    setApplyError: (applyError) => set({ applyError }),
    syncServerValues: (scopeKey, values) => {
      const current = get();
      const hasLocalChanges =
        current.initialized &&
        hasPendingChanges(current.baseline, current.draft);
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
    applying: false,
    applyError: null,
  });
}
