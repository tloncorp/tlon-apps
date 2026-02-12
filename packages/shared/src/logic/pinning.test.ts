import { describe, expect, test } from 'vitest';

import { Channel, Group, Pin, whichPin } from './pinning';

describe('whichPin', () => {
  test('should return pin-channel action when channel has no pin', () => {
    const channel: Channel = { id: 'channel-1', pin: null };
    const params = {
      chat: { type: 'channel' as const, id: 'channel-1' },
      channel,
    };

    const result = whichPin(params);

    expect(result.action).toBe('pin-channel');
    expect(result.target).toEqual(channel);
  });

  test('should return unpin action when channel has a pin', () => {
    const pin: Pin = { type: 'channel', index: 0, itemId: 'channel-1' };
    const channel: Channel = { id: 'channel-1', pin };
    const params = {
      chat: { type: 'channel' as const, id: 'channel-1' },
      channel,
    };

    const result = whichPin(params);

    expect(result.action).toBe('unpin');
    expect(result.target).toEqual(pin);
  });

  test('should return none when type is channel and channel is null', () => {
    const params = {
      chat: { type: 'channel' as const, id: 'channel-1' },
      channel: null,
    };

    const result = whichPin(params);

    expect(result.action).toBe('none');
    expect(result.target).toBeUndefined();
  });

  test('should return pin-group when group has no pin', () => {
    const group: Group = { id: 'group-1', pin: null };
    const params = {
      chat: { type: 'group' as const, id: 'group-1' },
      group,
    };

    const result = whichPin(params);

    expect(result.action).toBe('pin-group');
    expect(result.target).toEqual(group);
  });

  test('should return unpin when group has a pin', () => {
    const pin: Pin = { type: 'group', index: 0, itemId: 'group-1' };
    const group: Group = { id: 'group-1', pin };
    const params = {
      chat: { type: 'group' as const, id: 'group-1' },
      group,
    };

    const result = whichPin(params);

    expect(result.action).toBe('unpin');
    expect(result.target).toEqual(pin);
  });

  test('should return none when chat is null', () => {
    const params = {
      chat: null,
    };

    const result = whichPin(params);

    expect(result.action).toBe('none');
    expect(result.target).toBeUndefined();
  });

  test('should return none when chat type is invalid', () => {
    const params = {
      chat: { type: 'invalid' as any, id: 'test' },
    };

    const result = whichPin(params);

    expect(result.action).toBe('none');
    expect(result.target).toBeUndefined();
  });
});
