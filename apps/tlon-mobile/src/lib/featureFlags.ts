import storage from './storage';

export const featureMeta = {
  channelSwitcher: {
    default: false,
    label: 'Experimental channel switcher',
  },
};

export type FeatureName = keyof typeof featureMeta;

export type FeatureState = {
  [K in FeatureName]: boolean;
};

const featureState: { [K in FeatureName]: boolean } = {
  channelSwitcher: false,
};

export function setEnabled(name: FeatureName, enabled: boolean) {
  featureState[name] = enabled;
  saveState();
}

export function isEnabled(name: FeatureName) {
  return featureState[name];
}

const storageKey = 'featureFlags';

async function loadInitialState() {
  let state: FeatureState | null = null;
  try {
    state = await storage.load({ key: storageKey });
  } catch (e) {
    // ignore
  }
  if (state) {
    Object.assign(featureState, state);
  }
}
loadInitialState();

function saveState() {
  return storage.save({ key: storageKey, data: featureState });
}
