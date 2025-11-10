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
  },
  customChannelCreation: {
    default: false,
    label: 'Enable creating custom channels',
  },
  contactsTab: {
    default: false,
    label: 'Enable contacts tab',
  },
  aiSummarization: {
    default: false,
    label: 'Enable AI-powered message and channel summarization',
  },
} satisfies Record<string, { default: boolean; label: string }>;

export type FeatureName = keyof typeof featureMeta;

export type FeatureState = {
  [K in FeatureName]: boolean;
};

interface FeatureStateStore {
  flags: FeatureState;
  setEnabled: (name: FeatureName, enabled: boolean) => void;
}

export const useFeatureFlagStore = create<FeatureStateStore>((set) => ({
  flags: mapValues(featureMeta, (meta) => meta.default),

  setEnabled: (name: FeatureName, enabled: boolean) =>
    set((prev) => ({ ...prev, flags: { ...prev.flags, [name]: enabled } })),
}));

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
      } else {
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
