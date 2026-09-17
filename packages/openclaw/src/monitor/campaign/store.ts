import type { PluginStateKeyedStore } from 'openclaw/plugin-sdk/plugin-state-runtime';
import { sharedMap, sharedSlot } from '../../shared-state.js';
import type { CampaignState } from './model.js';

export type CampaignStore = PluginStateKeyedStore<CampaignState>;
const slot = sharedSlot<CampaignStore>('onboardingCampaign.store');
export const setCampaignStore = (store: CampaignStore | null) =>
  slot.set(store);
export const getCampaignStore = () => slot.get();
const writes = sharedMap<string, Promise<unknown>>('onboardingCampaign.writes');

export async function withCampaignLock<T>(
  owner: string,
  run: () => Promise<T>
): Promise<T> {
  const previous = writes.get(owner) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(run);
  writes.set(owner, current);
  try {
    return await current;
  } finally {
    if (writes.get(owner) === current) writes.delete(owner);
  }
}

export async function saveCampaign(store: CampaignStore, state: CampaignState) {
  // OpenClaw state rejects undefined even in optional fields.
  await store.register(
    state.owner,
    JSON.parse(JSON.stringify(state)) as CampaignState
  );
}
