import storage from './storage';

export const featureMeta = {
  channelSwitcher: {
    default: false,
    label: 'Experimental channel switcher',
  },
};

export type FeatureName = keyof typeof featureMeta;

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
  const state = await storage.load({ key: storageKey });
  if (state) {
    Object.assign(featureState, state);
  }
}
loadInitialState();

function saveState() {
  return storage.save({ key: storageKey, data: featureState });
}
