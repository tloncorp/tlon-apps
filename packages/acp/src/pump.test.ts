import { PassThrough } from 'node:stream';
import { describe, expect, test, vi } from 'vitest';

import type { AcpAdapter } from './adapter.js';
import { AcpPump, validateFrame } from './pump.js';
import type { AcpPeer, AcpTransport, AcpUpdateHandler } from './types.js';
import { parseAcpUpdate } from './types.js';

class FakeTransport implements AcpTransport {
  handler: AcpUpdateHandler | null = null;
  sent: Array<{ target: AcpPeer; payload: string }> = [];
  acked: Array<{ target: AcpPeer; through: number }> = [];

  open = vi.fn(async () => {});
  disconnect = vi.fn(async () => {});

  async send(target: AcpPeer, payload: string) {
    this.sent.push({ target, payload });
  }

  async ack(target: AcpPeer, through: number) {
    this.acked.push({ target, through });
  }

  async subscribe(_target: AcpPeer, handler: AcpUpdateHandler) {
    this.handler = handler;
    return () => {
      this.handler = null;
    };
  }
}

function fakeAdapter() {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  let exit!: (value: { code: number; signal: null }) => void;
  const adapter: AcpAdapter = {
    stdin,
    stdout,
    exited: new Promise((resolve) => {
      exit = resolve;
    }),
    stop: vi.fn(),
  };
  return { adapter, stdin, stdout, exit };
}

async function nextTurn() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('AcpPump', () => {
  test('delivers queued agent frames in sequence and cumulatively acks', async () => {
    const transport = new FakeTransport();
    const { adapter, stdin, exit } = fakeAdapter();
    const chunks: Buffer[] = [];
    stdin.on('data', (chunk: Buffer) => chunks.push(chunk));
    const pump = new AcpPump(transport, adapter);
    const running = pump.run();
    await nextTurn();

    transport.handler?.({
      messages: [
        { sequence: 2, sent: 'now', payload: '{"id":2}' },
        { sequence: 1, sent: 'now', payload: '{"id":1}' },
      ],
    });
    await nextTurn();
    await nextTurn();

    expect(Buffer.concat(chunks).toString()).toBe('{"id":1}\n{"id":2}\n');
    expect(transport.acked).toEqual([
      { target: 'agent', through: 1 },
      { target: 'agent', through: 2 },
    ]);

    exit({ code: 0, signal: null });
    await running;
  });

  test('serializes adapter stdout into the client queue', async () => {
    const transport = new FakeTransport();
    const { adapter, stdout, exit } = fakeAdapter();
    const pump = new AcpPump(transport, adapter);
    const running = pump.run();
    await nextTurn();

    stdout.write('{"jsonrpc":"2.0","id":1,"result":{}}\n');
    stdout.write('{"jsonrpc":"2.0","method":"session/update"}\n');
    await nextTurn();

    exit({ code: 0, signal: null });
    await running;
    expect(transport.sent).toEqual([
      {
        target: 'client',
        payload: '{"jsonrpc":"2.0","id":1,"result":{}}',
      },
      {
        target: 'client',
        payload: '{"jsonrpc":"2.0","method":"session/update"}',
      },
    ]);
  });
});

describe('validateFrame', () => {
  test('rejects malformed and non-object frames', () => {
    expect(() => validateFrame('{')).toThrow('not valid JSON');
    expect(() => validateFrame('[]')).toThrow('JSON-RPC object');
  });
});

describe('parseAcpUpdate', () => {
  test('parses the connection envelope emitted by the Gall mark', () => {
    expect(
      parseAcpUpdate({
        connection: {
          id: 'demo',
          open: true,
          reason: null,
        },
      })
    ).toEqual({ connection: 'demo', open: true, reason: null });
  });
});
