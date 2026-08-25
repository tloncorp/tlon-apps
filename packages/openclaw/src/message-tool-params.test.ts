import { describe, expect, it } from 'vitest';

import { sanitizeTlonMessageSendParams } from './message-tool-params.js';

describe('sanitizeTlonMessageSendParams', () => {
  it('removes strict-schema poll defaults from Tlon sends', () => {
    const params = {
      action: 'send',
      channel: 'tlon',
      target: '~ten',
      message: 'Forecast summary',
      pollQuestion: '',
      pollOption: [],
      pollDurationHours: 1,
      pollMulti: false,
      poll_option_indexes: [],
      a2ui: { root: 'root', components: [] },
    };

    const override = sanitizeTlonMessageSendParams('message', params);
    const mergedLikeOpenClaw = { ...params, ...override };

    expect(mergedLikeOpenClaw).toMatchObject({
      action: 'send',
      channel: 'tlon',
      target: '~ten',
      message: 'Forecast summary',
      pollQuestion: undefined,
      pollOption: undefined,
      pollDurationHours: undefined,
      pollMulti: undefined,
      poll_option_indexes: undefined,
      a2ui: { root: 'root', components: [] },
    });
    expect(params).toHaveProperty('pollDurationHours', 1);
  });

  it('does not rewrite genuine poll actions', () => {
    const params = {
      action: 'poll',
      channel: 'tlon',
      pollQuestion: 'Choose one',
      pollOption: ['A', 'B'],
    };

    expect(sanitizeTlonMessageSendParams('message', params)).toBe(params);
  });

  it('uses the active Tlon channel when the tool omits channel', () => {
    const params = {
      action: 'send',
      target: '~ten',
      message: 'Forecast summary',
      pollDurationHours: 1,
    };

    const override = sanitizeTlonMessageSendParams('message', params, 'tlon');

    expect({ ...params, ...override }).toMatchObject({
      action: 'send',
      target: '~ten',
      pollDurationHours: undefined,
    });
  });

  it('does not infer Tlon when channel is omitted outside Tlon', () => {
    const params = {
      action: 'send',
      target: '123',
      pollDurationHours: 1,
    };

    expect(sanitizeTlonMessageSendParams('message', params, 'discord')).toBe(
      params
    );
  });

  it('does not rewrite another channel or tool', () => {
    const params = {
      action: 'send',
      channel: 'discord',
      pollDurationHours: 1,
    };

    expect(sanitizeTlonMessageSendParams('message', params)).toBe(params);
    expect(sanitizeTlonMessageSendParams('tlon', params)).toBe(params);
  });

  it('preserves object identity when no poll fields are present', () => {
    const params = {
      action: 'send',
      channel: 'tlon',
      message: 'Hello',
    };

    expect(sanitizeTlonMessageSendParams('message', params)).toBe(params);
  });
});
