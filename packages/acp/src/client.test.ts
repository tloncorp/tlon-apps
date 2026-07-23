import { describe, expect, test, vi } from 'vitest';

import { AcpClient } from './client.js';
import type { AcpPeer, AcpTransport, AcpUpdateHandler } from './types.js';

class FakeTransport implements AcpTransport {
  handler: AcpUpdateHandler | null = null;
  sent: Array<{ target: AcpPeer; frame: Record<string, unknown> }> = [];
  acked: number[] = [];

  async open() {}
  async disconnect() {}

  async send(target: AcpPeer, payload: string) {
    const frame = JSON.parse(payload) as Record<string, unknown>;
    this.sent.push({ target, frame });
    if (frame.method === 'initialize') {
      queueMicrotask(() => {
        this.push({
          jsonrpc: '2.0',
          id: frame.id,
          result: { protocolVersion: 1, agentCapabilities: {} },
        });
      });
    }
  }

  async ack(_target: AcpPeer, through: number) {
    this.acked.push(through);
  }

  async subscribe(_target: AcpPeer, handler: AcpUpdateHandler) {
    this.handler = handler;
    return () => {
      this.handler = null;
    };
  }

  push(frame: Record<string, unknown>) {
    const sequence = (this.acked.at(-1) ?? 0) + 1;
    this.handler?.({
      messages: [
        {
          sequence,
          sent: 'now',
          payload: JSON.stringify(frame),
        },
      ],
    });
  }
}

describe('AcpClient', () => {
  test('initializes and resolves requests from durable client frames', async () => {
    const transport = new FakeTransport();
    const client = new AcpClient(transport);
    await expect(client.start()).resolves.toMatchObject({ protocolVersion: 1 });

    const pending = client.request('session/new', {
      cwd: '/tmp',
      mcpServers: [],
    });
    const request = transport.sent.at(-1)!.frame;
    transport.push({
      jsonrpc: '2.0',
      id: request.id,
      result: { sessionId: 'session-1' },
    });

    await expect(pending).resolves.toEqual({ sessionId: 'session-1' });
    expect(transport.acked).toEqual([1, 2]);
    await client.stop();
  });

  test('denies permission requests by default', async () => {
    const transport = new FakeTransport();
    const client = new AcpClient(transport);
    client.on('error', vi.fn());
    await client.start();
    transport.push({
      jsonrpc: '2.0',
      id: 99,
      method: 'session/request_permission',
      params: {
        options: [
          { optionId: 'allow', kind: 'allow_once' },
          { optionId: 'reject', kind: 'reject_once' },
        ],
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(transport.sent.at(-1)?.frame).toMatchObject({
      id: 99,
      result: { outcome: { outcome: 'selected', optionId: 'reject' } },
    });
    await client.stop();
  });
});
