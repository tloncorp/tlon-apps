/**
 * Cross-repo fixture pinning for the `messageId` timestamp encoding.
 *
 * This file is intentionally split out from `send.test.ts` so the existing
 * file-level `vi.mock("@urbit/aura", ...)` in that file does not silently
 * re-mock the canary here. The pinned fixtures below assert that the
 * production `formatSentAt` (which composes the real `@urbit/aura`
 * `scot("ud", da.fromUnix(sentAt))`) produces the same `messageId` shape
 * that Homestead's `getIdParts` test in
 * `homestead/packages/shared/src/api/__tests__/dmTapTelemetryRoundTrip.test.ts`
 * inverts.
 *
 * IMPORTANT: do not add a top-level `vi.mock("@urbit/aura", ...)` here.
 * The whole point of this file is to exercise the *real* encoding pipeline.
 * If you find yourself wanting to mock aura for a different test, put that
 * test in `send.test.ts` (which already has the file-level mock) instead.
 */

import { describe, expect, test } from "vitest";

import { formatSentAt } from "./send.js";

// The same fixtures used by the Homestead-side canary. Any change here
// requires landing the same change on the Homestead side as a paired PR.
const BOT_SHIP = "~botnul-banpex-ravseg-nosduc";

const FIXTURES: Array<{ sentAt: number; expectedMessageId: string }> = [
  {
    sentAt: 1700000000000,
    expectedMessageId:
      "~botnul-banpex-ravseg-nosduc/170.141.184.506.511.632.882.809.306.892.730.368.000",
  },
  {
    sentAt: 1700000000123,
    expectedMessageId:
      "~botnul-banpex-ravseg-nosduc/170.141.184.506.511.632.885.078.256.413.796.642.848",
  },
  {
    sentAt: 1700000000999,
    expectedMessageId:
      "~botnul-banpex-ravseg-nosduc/170.141.184.506.511.632.901.237.604.222.366.210.064",
  },
];

describe("formatSentAt — cross-repo messageId fixture pinning", () => {
  for (const fixture of FIXTURES) {
    test(`formats sentAt=${fixture.sentAt} into the pinned messageId`, () => {
      const messageId = `${BOT_SHIP}/${formatSentAt(fixture.sentAt)}`;
      expect(messageId).toBe(fixture.expectedMessageId);
    });
  }
});
