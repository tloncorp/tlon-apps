import assert from 'node:assert/strict';
import test from 'node:test';

import { observeNoTrue } from './observe-absence';

test('detects a notifying event that appears late in the observation window', async () => {
  let time = 0;
  const result = await observeNoTrue({
    markers: { ordinary: 'ordinary', mention: 'mention', reply: 'reply' },
    read: async (marker) => marker === 'mention' && time >= 3,
    observationMs: 5,
    pollMs: 1,
    now: () => time,
    sleep: async (duration) => {
      time += duration;
    },
  });
  assert.equal(result.mention, true);
});

test('tolerates transient reads but requires a successful final read', async () => {
  let time = 0;
  let attempts = 0;
  const result = await observeNoTrue({
    markers: { ordinary: 'ordinary', mention: 'mention', reply: 'reply' },
    read: async () => {
      attempts += 1;
      if (attempts <= 6) throw new Error('temporary scry failure');
      return undefined;
    },
    observationMs: 2,
    finalReadTimeoutMs: 3,
    pollMs: 1,
    now: () => time,
    sleep: async (duration) => {
      time += duration;
    },
  });
  assert.deepEqual(result, {
    ordinary: undefined,
    mention: undefined,
    reply: undefined,
  });
  assert.ok(attempts >= 9);
});
