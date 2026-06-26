import { da, scot } from '@urbit/aura';
import { describe, expect, it } from 'vitest';

import { parseLensMessageId } from './lensPost';

// mirrors the gateway's formatSentAt (src/urbit/send.ts)
function gatewayMessageId(ship: string, sentAt: number) {
  return `${ship}/${scot('ud', da.fromUnix(sentAt))}`;
}

describe('parseLensMessageId', () => {
  it('round-trips the gateway send-time encoding exactly', () => {
    const sentAt = 1718200000123;
    expect(
      parseLensMessageId(gatewayMessageId('~malmur-halmex', sentAt))
    ).toEqual({ authorId: '~malmur-halmex', sentAt });
  });

  it('rejects ids without a sigged ship prefix', () => {
    expect(parseLensMessageId('malmur-halmex/170.141')).toBeNull();
    expect(parseLensMessageId('170.141.184.508')).toBeNull();
    expect(parseLensMessageId('/170.141')).toBeNull();
  });

  it('rejects malformed tails', () => {
    expect(parseLensMessageId('~malmur-halmex/')).toBeNull();
    expect(parseLensMessageId('~malmur-halmex/not-a-number')).toBeNull();
    expect(parseLensMessageId('~malmur-halmex/0')).toBeNull();
  });
});
