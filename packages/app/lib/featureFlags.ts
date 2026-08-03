import { storage } from '@tloncorp/shared/db';
import { featureFlags as mirrorFeatureFlags } from '@tloncorp/shared/logic';
import { useMutableCallback } from '@tloncorp/shared/logic';
import { mapValues } from 'lodash';
import create from 'zustand';

// Add new feature flags here:
export const featureMeta = {
  instrumentationEnabled: {
    default: false,
    label: 'Enable collecting and reporting performance data',
    onlyTlon: false,
  },
  contactsTab: {
    default: false,
    label: 'Enable contacts tab',
    onlyTlon: false,
  },
  conversationalOnboarding: {
    default: true,
    label: 'Conversational onboarding (agent builds your first group)',
    onlyTlon: false,
  },
  markdownNotebooks: {
    default: false,
    label: 'Enable Markdown mode for notebook posts',
    onlyTlon: true,
  },
} satisfies Record<
  string,
  { default: boolean; label: string; onlyTlon: boolean }
>;

export type FeatureName = keyof typeof featureMeta;

export type FeatureState = {
  [K in FeatureName]: boolean;
};

interface FeatureStateStore {
  flags: FeatureState;
  /** False until stored overrides have been read; see `useFeatureFlagsLoaded`. */
  loaded: boolean;
  setEnabled: (name: FeatureName, enabled: boolean) => void;
  setLoaded: () => void;
}

export const useFeatureFlagStore = create<FeatureStateStore>((set) => ({
  flags: mapValues(featureMeta, (meta) => meta.default),
  loaded: false,

  setEnabled: (name: FeatureName, enabled: boolean) =>
    set((prev) => ({ ...prev, flags: { ...prev.flags, [name]: enabled } })),
  setLoaded: () => set((prev) => ({ ...prev, loaded: true })),
}));

/**
 * Whether stored flag overrides have loaded.
 *
 * Until they have, every flag reads as its compiled-in default — so a
 * one-shot, irreversible action gated on a default-true flag would fire once
 * for a user who has it turned off. Reversible UI can ignore this; anything
 * that only happens once should wait.
 */
export function useFeatureFlagsLoaded(): boolean {
  return useFeatureFlagStore((s) => s.loaded);
}

export function setEnabled(name: FeatureName, enabled: boolean) {
  useFeatureFlagStore.getState().setEnabled(name, enabled);
}

/**  Prefer `useFeatureFlag` in React for reactivity. */
export function isEnabled(name: FeatureName) {
  return useFeatureFlagStore.getState().flags[name];
}

export function useFeatureFlag(
  name: FeatureName
): readonly [value: boolean, setEnabled: (enabled: boolean) => void] {
  const enabled = useFeatureFlagStore((state) => state.flags[name]);
  const setEnabled = useMutableCallback(
    useFeatureFlagStore(
      (s) => (enabled: boolean) => s.setEnabled(name, enabled)
    )
  );
  return [enabled, setEnabled];
}

async function loadInitialState() {
  let state: FeatureState | null = null;
  try {
    state = await storage.featureFlags.getValue();
  } catch (e) {
    // ignore
  }
  if (state) {
    Object.entries(state).forEach(([name, enabled]) => {
      if (name in featureMeta) {
        useFeatureFlagStore.getState().setEnabled(name as FeatureName, enabled);
      } else if (name !== 'contextLens') {
        // `contextLens` is a legacy flag migrated to the synced %settings store
        // (see migrateLegacyContextLensFlag); it's expected here until stripped.
        console.warn('Unknown feature flag encountered in local storage', name);
      }
    });
    mirrorFeatureFlags.updateFeatureFlags((prev) => ({
      ...prev,
      ...useFeatureFlagStore.getState().flags,
    }));
  }
}

async function setup() {
  await loadInitialState();
  useFeatureFlagStore.getState().setLoaded();

  // Write to local storage on changes, but only after initial load
  useFeatureFlagStore.subscribe(async (state) => {
    mirrorFeatureFlags.updateFeatureFlags((prev) => ({
      ...prev,
      ...state.flags,
    }));
    await storage.featureFlags.setValue(state.flags);
  });
}
setup();
