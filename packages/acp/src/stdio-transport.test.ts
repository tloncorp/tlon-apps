import { PassThrough } from 'node:stream';
import { describe, expect, test } from 'vitest';

import type { AcpAdapter } from './adapter.js';
import { StdioAcpTransport } from './stdio-transport.js';

function fakeAdapter() {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const adapter: AcpAdapter = {
    stdin,
    stdout,
    exited: new Promise(() => undefined),
    stop() {},
  };
  return { adapter, stdin, stdout };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('StdioAcpTransport', () => {
  test('writes agent frames and exposes adapter output to the client', async () => {
    const { adapter, stdin, stdout } = fakeAdapter();
    const transport = new StdioAcpTransport(adapter);
    const input: string[] = [];
    stdin.on('data', (chunk) => input.push(String(chunk)));
    const updates: unknown[] = [];

    await transport.open();
    await transport.subscribe((update) => updates.push(update));
    await transport.send('{"jsonrpc":"2.0","id":1,"method":"initialize"}');
    stdout.write('{"jsonrpc":"2.0","id":1,"result":{}}\n');
    await new Promise((resolve) => setImmediate(resolve));

    expect(input.join('')).toContain('"method":"initialize"');
    expect(updates).toEqual([
      {
        messages: [
          expect.objectContaining({
            sequence: 1,
            payload: '{"jsonrpc":"2.0","id":1,"result":{}}',
          }),
        ],
      },
    ]);
  });

  test('reports an adapter that exits before output is subscribed', async () => {
    const exit = deferred<{ code: number | null; signal: null }>();
    const adapter: AcpAdapter = {
      stdin: new PassThrough(),
      stdout: new PassThrough(),
      exited: exit.promise,
      stop() {},
    };
    const transport = new StdioAcpTransport(adapter);
    await transport.open();
    exit.resolve({ code: 1, signal: null });
    await new Promise((resolve) => setImmediate(resolve));
    const errors: unknown[] = [];
    await transport.subscribe(
      () => undefined,
      (error) => errors.push(error)
    );
    await new Promise((resolve) => setImmediate(resolve));
    expect(String(errors[0])).toContain('exited with code 1');
  });
});
