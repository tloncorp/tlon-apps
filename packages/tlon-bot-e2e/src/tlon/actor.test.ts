import { describe, expect, test } from 'vitest';

import { TlonActorClient } from './actor.js';

describe('TlonActorClient DM baseline handling', () => {
  test('keeps best-effort latestSequenceFrom only for explicit callers', async () => {
    const client = actorClient();
    client.state.channelPosts = async () => {
      throw new Error('history unavailable');
    };

    await expect(client.latestSequenceFrom('~zod', '~zod')).resolves.toBe(-1);
    await expect(
      client.latestSequenceFrom('~zod', '~zod', { strict: true })
    ).rejects.toThrow(/Failed to read DM baseline.*~zod.*history unavailable/);
  });

  test('promptDm fails before sending when strict baseline capture fails', async () => {
    const client = actorClient();
    const sentPrompts: string[] = [];
    client.state.channelPosts = async () => {
      throw new Error('history unavailable');
    };
    (
      client as unknown as {
        sendDm(toShip: string, message: string): Promise<void>;
      }
    ).sendDm = async (_toShip, message) => {
      sentPrompts.push(message);
    };

    const result = await client.promptDm('~zod', 'hello');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Failed to capture DM baseline from ~zod/);
    expect(result.error).toContain('history unavailable');
    expect(sentPrompts).toEqual([]);
  });
});

function actorClient(): TlonActorClient {
  return new TlonActorClient({
    shipUrl: 'http://127.0.0.1:12345',
    shipName: '~ten',
    code: 'code',
  });
}
