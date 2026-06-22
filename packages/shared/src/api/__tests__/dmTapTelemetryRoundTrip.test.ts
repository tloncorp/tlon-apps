import { getIdParts } from '@tloncorp/api/urbit';
import { describe, expect, test } from 'vitest';

// Pinned fixture table. These literal `messageId` values are computed via
// OpenClaw's `formatSentAt` (`scot('ud', da.fromUnix(sentAt))`) and must
// round-trip losslessly through Homestead's `getIdParts`. If either side
// changes its encoding, this test or its OpenClaw sibling
// (`openclaw-tlon/src/urbit/send.fixtures.test.ts`) will fail.
//
// Changing this table requires landing the same change in the OpenClaw repo
// as a paired PR.
const FIXTURES: Array<{ sentAt: number; messageId: string }> = [
  {
    sentAt: 1700000000000,
    messageId:
      '~botnul-banpex-ravseg-nosduc/170.141.184.506.511.632.882.809.306.892.730.368.000',
  },
  {
    sentAt: 1700000000123,
    messageId:
      '~botnul-banpex-ravseg-nosduc/170.141.184.506.511.632.885.078.256.413.796.642.848',
  },
  {
    sentAt: 1700000000999,
    messageId:
      '~botnul-banpex-ravseg-nosduc/170.141.184.506.511.632.901.237.604.222.366.210.064',
  },
];

describe('dmTap telemetry messageId round-trip', () => {
  for (const fixture of FIXTURES) {
    test(`getIdParts inverts formatSentAt for sentAt=${fixture.sentAt}`, () => {
      const parts = getIdParts(fixture.messageId);
      expect(parts.author).toBe('~botnul-banpex-ravseg-nosduc');
      expect(parts.sent).toBe(fixture.sentAt);
    });
  }
});
