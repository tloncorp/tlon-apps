import { beforeEach, describe, expect, it } from 'vitest';

import {
  EMPTY_VALUES,
  resetBotSettingsDraft,
  useBotSettingsDraftStore,
} from './botSettingsDraftStore';

const snapshot = {
  '~zod/garden': {
    rules: { 'chat/~zod/plots': { mode: 'open' as const, allowedShips: '' } },
    saved: '[]',
  },
};

const withRule = {
  ...EMPTY_VALUES,
  chat: {
    ...EMPTY_VALUES.chat,
    channelRuleDrafts: {
      'chat/~zod/plots': { mode: 'open' as const, allowedShips: '' },
    },
  },
};

describe('cleared group rules', () => {
  beforeEach(() => {
    resetBotSettingsDraft();
    useBotSettingsDraftStore.getState().syncServerValues('zod', withRule);
    useBotSettingsDraftStore.getState().setClearedGroupRules(() => snapshot);
  });

  it('outlive the screen, surviving draft edits', () => {
    useBotSettingsDraftStore
      .getState()
      .commitDraft((draft) => ({ ...draft, nickname: 'Bot' }));
    expect(useBotSettingsDraftStore.getState().clearedGroupRules).toEqual(
      snapshot
    );
  });

  it('are dropped when the draft is discarded', () => {
    useBotSettingsDraftStore.getState().discardChanges();
    expect(useBotSettingsDraftStore.getState().clearedGroupRules).toEqual({});
  });

  it('are dropped when another ship syncs in', () => {
    useBotSettingsDraftStore.getState().syncServerValues('nec', EMPTY_VALUES);
    expect(useBotSettingsDraftStore.getState().clearedGroupRules).toEqual({});
  });

  it('are dropped on logout', () => {
    resetBotSettingsDraft();
    expect(useBotSettingsDraftStore.getState().clearedGroupRules).toEqual({});
  });
});
