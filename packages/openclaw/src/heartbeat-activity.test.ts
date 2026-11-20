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

it('keys mentions and replies without their ages, and not unreads', async () => {
  const read =
    (output: Record<string, string>, fail?: string) =>
    async (list: string, { ownerShip }: { ownerShip?: string }) => {
      const name = `${ownerShip ? 'owner' : 'bot'} ${list}`;
      if (name === fail) throw new Error('timed out');
      return output[name] ?? `No ${list} activity found.`;
    };
  const key = async (output: Record<string, string>, fail?: string) =>
    (await readHeartbeatActivity(read(output, fail), '/tmp', '~zod')).changeKey;
  const mention = (age: string) =>
    `📝 Post [MENTION] by ~nec in chat/~h/general\n   Time: 2026-11-20T15:00:00Z (${age})\n   Content: are you there?`;

  const base = await key({ 'owner mentions': mention('5m ago') });
  expect(base).toBeDefined();
  expect(await key({ 'owner mentions': mention('2h ago') })).toBe(base);
  expect(await key({ 'owner mentions': mention('just now') })).toBe(base);
  expect(
    await key({
      'owner mentions': mention('5m ago'),
      'owner unreads': 'chat/~h/general\n   Count: 9',
    })
  ).toBe(base);

  expect(
    await key({
      'owner mentions': mention('5m ago') + '\n\n' + mention('1m ago'),
    })
  ).not.toBe(base);
  expect(
    await key({
      'owner mentions': mention('5m ago'),
      'bot replies': mention('5m ago'),
    })
  ).not.toBe(base);
  expect(
    await key({ 'owner mentions': mention('5m ago') }, 'bot replies')
  ).toBe(undefined);
  // Without an owner, only the bot's lists are watched.
  expect(
    (await readHeartbeatActivity(read({}, 'owner mentions'), '/tmp', undefined))
      .changeKey
  ).toBeDefined();
});
