import { describe, expect, it } from 'vitest';

import {
  type BotSettingsPendingFields,
  getChangeLabels,
} from './botSettingsDraftHelpers';

const noPending: BotSettingsPendingFields = {
  nickname: false,
  modelProvider: false,
  model: false,
  fallbacks: false,
  dmAllowlist: false,
  defaultAuthorizedShips: false,
  groupInviteAllowlist: false,
  autoAcceptDmInvites: false,
  autoDiscoverChannels: false,
  channelRules: false,
};

describe('getChangeLabels', () => {
  it('counts a provider/model pair as one default-model change', () => {
    expect(
      getChangeLabels({
        ...noPending,
        modelProvider: true,
        model: true,
      })
    ).toEqual(['Default model']);
  });

  it('still tracks fallbacks separately from the default model', () => {
    expect(
      getChangeLabels({
        ...noPending,
        model: true,
        fallbacks: true,
      })
    ).toEqual(['Default model', 'Fallback models']);
  });
});
