import { describe, expect, it } from 'vitest';

import { followsByChannelOrder } from './postOrdering';

describe('followsByChannelOrder', () => {
  it('prefers authoritative channel sequence numbers over sender timestamps', () => {
    expect(
      followsByChannelOrder(
        { receivedAt: 100, sequenceNum: 3 },
        { receivedAt: 200, sequenceNum: 2 }
      )
    ).toBe(true);
    expect(
      followsByChannelOrder(
        { receivedAt: 200, sequenceNum: 2 },
        { receivedAt: 100, sequenceNum: 3 }
      )
    ).toBe(false);
  });

  it('falls back to received time without two positive sequence numbers', () => {
    expect(
      followsByChannelOrder(
        { receivedAt: 200, sequenceNum: null },
        { receivedAt: 100, sequenceNum: 1 }
      )
    ).toBe(true);
  });
});
