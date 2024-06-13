import storage from './storage';

type ChannelSortPreference = 'recency' | 'arranged';

// in the future we could set sort preference by group ID
const channelSortPreferenceState: {
  sortPreference: ChannelSortPreference;
} = {
  sortPreference: 'recency',
};

export function setChannelSortPreference(
  sortPreference: ChannelSortPreference
) {
  channelSortPreferenceState.sortPreference = sortPreference;
  saveState();
}

export function getChannelSortPreference() {
  return channelSortPreferenceState.sortPreference;
}

const storageKey = 'channelSortPreference';

async function loadInitialState() {
  const state = await storage.load({ key: storageKey });
  if (state) {
    Object.assign(channelSortPreferenceState, state);
  }
}

loadInitialState();

function saveState() {
  return storage.save({ key: storageKey, data: channelSortPreferenceState });
}
