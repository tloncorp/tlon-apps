import { beforeEach, describe, expect, it } from 'vitest';

import {
  resetBotSettingsDraft,
  useBotSettingsDraftStore,
} from './botSettingsDraftStore';

// Several surfaces render an apply bar over the same draft — the Settings tab
// plus whichever bot screen is open on top of it. They each mount their own
// copy of the apply hook, so the apply state has to live in the store: a bar
// reading a stale applying=false would let the user start a second apply and
// restart the gateway twice.
describe('bot settings apply state', () => {
  beforeEach(() => {
    resetBotSettingsDraft();
  });

  it('is shared, so a second surface sees an apply already in flight', () => {
    useBotSettingsDraftStore.getState().setApplying(true);

    expect(useBotSettingsDraftStore.getState().applying).toBe(true);
  });

  it('shares the apply error rather than stranding it on one screen', () => {
    useBotSettingsDraftStore.getState().setApplyError('Something broke.');

    expect(useBotSettingsDraftStore.getState().applyError).toBe(
      'Something broke.'
    );
  });

  it('clears apply state on logout, along with the draft', () => {
    useBotSettingsDraftStore.getState().setApplying(true);
    useBotSettingsDraftStore.getState().setApplyError('Something broke.');

    resetBotSettingsDraft();

    expect(useBotSettingsDraftStore.getState().applying).toBe(false);
    expect(useBotSettingsDraftStore.getState().applyError).toBeNull();
    expect(useBotSettingsDraftStore.getState().initialized).toBe(false);
  });
});
