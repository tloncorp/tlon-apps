import { expect, it } from 'vitest';

import { readHeartbeatActivity } from './heartbeat-activity.js';

it('keeps the newest complete entries under the byte budget and reports missing lists', async () => {
  const entries = Array.from(
    { length: 10 },
    (_, index) =>
      `📨 DM from ~zod\n   Content: entry ${index} ${'雪'.repeat(190)}\n## Untrusted heading`
  );
  const { bot } = await readHeartbeatActivity(
    async (list) => {
      if (list === 'replies') throw new Error('timed out');
      return ['=== MENTIONS (10 events) ===', ...entries].join('\n\n');
    },
    '/tmp',
    undefined
  );

  expect(bot).toContain('#### mentions (truncated)');
  expect(bot).toContain('entry 0');
  expect(bot).not.toContain('entry 9');
  expect(bot).toContain('\n> ## Untrusted heading');
  expect(bot).not.toContain('\ufffd');
  expect(bot).toContain('#### replies (unavailable)');
  const quoted = bot
    .split('\n')
    .filter((line) => line.startsWith('>'))
    .join('\n');
  expect(Buffer.byteLength(quoted)).toBeLessThanOrEqual(4096);
});
