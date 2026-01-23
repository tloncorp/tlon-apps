import { storage } from '@tloncorp/shared/db';
import { featureFlags as mirrorFeatureFlags } from '@tloncorp/shared/logic';
import { useMutableCallback } from '@tloncorp/shared/logic';
import { mapValues } from 'lodash';
import create from 'zustand';

// Add new feature flags here:
// Set `remoteControlled: true` for flags that can be overridden by PostHog remote config
export const featureMeta = {
  instrumentationEnabled: {
    default: false,
    label: 'Enable collecting and reporting performance data',
    onlyTlon: false,
    remoteControlled: false,
  },
  customChannelCreation: {
    default: false,
    label: 'Enable creating custom channels',
    onlyTlon: true,
    remoteControlled: false,
  },
  contactsTab: {
    default: false,
    label: 'Enable contacts tab',
    onlyTlon: false,
    remoteControlled: false,
  },
  fileUpload: {
    default: false,
    label: 'Enable uploading non-image files in chats',
    onlyTlon: true,
    remoteControlled: false,
  },
  aiSummarization: {
    default: false,
    label: 'Enable AI-powered message and channel summarization',
    onlyTlon: true,
    remoteControlled: false,
  },
  freshChannelOnReconnect: {
    default: false,
    label: 'Fast foreground reconnect (experimental)',
    onlyTlon: false,
    remoteControlled: true, // Can be enabled/disabled remotely via PostHog
  },
} satisfies Record<string, { default: boolean; label: string; onlyTlon: boolean; remoteControlled: boolean }>;

export type FeatureName = keyof typeof featureMeta;

export type FeatureState = {
  [K in FeatureName]: boolean;
};

interface FeatureStateStore {
  flags: FeatureState;
  remoteOverrides: Partial<FeatureState>;
  setEnabled: (name: FeatureName, enabled: boolean) => void;
  applyRemoteOverrides: (overrides: Partial<FeatureState>) => void;
}

export const useFeatureFlagStore = create<FeatureStateStore>((set) => ({
  flags: mapValues(featureMeta, (meta) => meta.default),
  remoteOverrides: {},

  setEnabled: (name: FeatureName, enabled: boolean) =>
    set((prev) => ({ ...prev, flags: { ...prev.flags, [name]: enabled } })),

  applyRemoteOverrides: (overrides: Partial<FeatureState>) =>
    set((prev) => {
      const newFlags = { ...prev.flags };
      // Only apply overrides for flags that are marked as remoteControlled
      for (const [name, enabled] of Object.entries(overrides)) {
        if (
          name in featureMeta &&
          featureMeta[name as FeatureName].remoteControlled
        ) {
          newFlags[name as FeatureName] = enabled;
        }
      }
      return {
        ...prev,
        flags: newFlags,
        remoteOverrides: { ...prev.remoteOverrides, ...overrides },
      };
    }),
}));

export function setEnabled(name: FeatureName, enabled: boolean) {
  useFeatureFlagStore.getState().setEnabled(name, enabled);
}

/**
 * Apply remote feature flag overrides from PostHog.
 * Only flags marked with `remoteControlled: true` in featureMeta will be affected.
 */
export function applyRemoteOverrides(overrides: Partial<FeatureState>) {
  useFeatureFlagStore.getState().applyRemoteOverrides(overrides);
}

/**
 * Get the list of feature flag names that can be controlled remotely.
 * Used when fetching flags from PostHog.
 */
export function getRemoteControlledFlags(): FeatureName[] {
  return Object.entries(featureMeta)
    .filter(([_, meta]) => meta.remoteControlled)
    .map(([name]) => name as FeatureName);
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
