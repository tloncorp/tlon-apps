import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { parseSettingsResponse } from './settings.js';

type BucketCase = {
  name: string;
  bucket: Record<string, unknown>;
  expected: Record<string, unknown>;
};

const fixturePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../hermes-tlon-adapter/fixtures/nudge-settings-contract.json'
);
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as {
  buckets: BucketCase[];
  pythonSerializedPendingNudge: string;
};

function normalizeNudgeSettings(
  settings: ReturnType<typeof parseSettingsResponse>
) {
  return {
    lastOwnerMessageAt: settings.lastOwnerMessageAt ?? null,
    lastOwnerMessageDate: settings.lastOwnerMessageDate ?? null,
    pendingNudge: settings.pendingNudge ?? null,
    lastNudgeStage: settings.lastNudgeStage ?? null,
    nudgeActiveHoursStart: settings.nudgeActiveHoursStart ?? null,
    nudgeActiveHoursEnd: settings.nudgeActiveHoursEnd ?? null,
    nudgeActiveHoursTimezone: settings.nudgeActiveHoursTimezone ?? null,
  };
}

describe('Hermes/OpenClaw nudge settings contract', () => {
  it.each(fixture.buckets)('$name', ({ bucket, expected }) => {
    expect(
      normalizeNudgeSettings(parseSettingsResponse({ tlon: bucket }))
    ).toEqual(expected);
  });

  it('reads a PendingNudge serialized by Hermes', () => {
    expect(
      parseSettingsResponse({
        tlon: { pendingNudge: fixture.pythonSerializedPendingNudge },
      }).pendingNudge
    ).toEqual({
      sentAt: 1700000000123,
      stage: 3,
      ownerShip: '~ten',
      accountId: 'hermes',
      content: 'round trip',
    });
  });
});
