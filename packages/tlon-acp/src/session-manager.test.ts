import type { JsonRpcObject } from '@tloncorp/acp';
import { EventEmitter } from 'node:events';
import { describe, expect, test } from 'vitest';

import type { InboundTlonMessage } from './routing.js';
import { AcpSessionManager } from './session-manager.js';
import { MemorySessionStore } from './session-store.js';

class FakeClient extends EventEmitter {
  requests: Array<{ method: string; params: unknown }> = [];
  promptsInFlight = 0;
  maxPromptsInFlight = 0;

  async request(method: string, params: unknown): Promise<unknown> {
    this.requests.push({ method, params });
    if (method === 'session/new') return { sessionId: 'one' };
    if (method === 'session/prompt') {
      this.promptsInFlight += 1;
      this.maxPromptsInFlight = Math.max(
        this.maxPromptsInFlight,
        this.promptsInFlight
      );
      const sessionId = (params as { sessionId: string }).sessionId;
      await new Promise((resolve) => setTimeout(resolve, 2));
      this.emit('notification', {
        jsonrpc: '2.0',
        method: 'session/update',
        params: {
          sessionId,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: 'answer' },
          },
        },
      } satisfies JsonRpcObject);
      this.promptsInFlight -= 1;
      return { stopReason: 'end_turn' };
    }
    return {};
  }
}

const message: InboundTlonMessage = {
  key: 'dm:zod',
  kind: 'dm',
  target: '~zod',
  sender: 'zod',
  messageId: 'zod/1',
  text: 'question',
};

describe('AcpSessionManager', () => {
  test('creates a session and collects streamed message chunks', async () => {
    const client = new FakeClient();
    const manager = new AcpSessionManager(client, {
      cwd: '/workspace',
      store: new MemorySessionStore(),
    });
    await manager.start();

    await expect(manager.prompt(message)).resolves.toBe('answer');
    expect(client.requests.map(({ method }) => method)).toEqual([
      'session/new',
      'session/prompt',
    ]);
  });

  test('serializes turns in the same Tlon conversation', async () => {
    const client = new FakeClient();
    const manager = new AcpSessionManager(client, {
      cwd: '/workspace',
      store: new MemorySessionStore(),
    });
    await manager.start();
    await Promise.all([
      manager.prompt(message),
      manager.prompt({ ...message, messageId: 'zod/2' }),
    ]);
    expect(client.maxPromptsInFlight).toBe(1);
  });
});
