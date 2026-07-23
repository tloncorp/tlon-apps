import { describe, expect, test } from 'vitest';

import { parseBusRequest } from './tlon-message-bus.js';

describe('parseBusRequest', () => {
  test('normalizes a direct-message request', () => {
    expect(
      parseBusRequest({
        sequence: 7,
        sender: '~ZOD',
        'message-id': '~zod/~2026.07.23',
        text: 'hello',
        conversation: { dm: '~ZOD' },
      })
    ).toEqual({
      sequence: 7,
      key: 'dm:zod',
      kind: 'dm',
      target: '~zod',
      sender: 'zod',
      messageId: '~zod/~2026.07.23',
      text: 'hello',
    });
  });

  test('preserves a channel nest', () => {
    expect(
      parseBusRequest({
        sequence: 8,
        sender: '~bus',
        'message-id': '~bus/~2026.07.23',
        text: 'hello channel',
        conversation: { channel: 'chat/~zod/general' },
      })
    ).toMatchObject({
      sequence: 8,
      key: 'channel:chat/~zod/general',
      kind: 'channel',
      target: 'chat/~zod/general',
      sender: 'bus',
    });
  });
});
