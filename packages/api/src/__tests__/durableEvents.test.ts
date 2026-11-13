import { afterEach, expect, test, vi } from 'vitest';
import { DurableConnection } from '../client/durableEvents';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test('many subscriptions share one socket, filter room events, and reconnect together', async () => {
  vi.useFakeTimers();
  const sockets: Socket[] = [];
  class Socket {
    static OPEN = 1;
    readyState = 0;
    send = vi.fn();
    onopen?: () => void;
    onmessage?: (event: MessageEvent) => void;
    onerror?: () => void;
    onclose?: () => void;
    close = vi.fn(() => {
      this.readyState = 3;
      this.onclose?.();
    });
    constructor(_url: string) {
      sockets.push(this);
    }
  }
  vi.stubGlobal('WebSocket', Socket);
  const connection = new DurableConnection(
    () => 'ws://localhost/v1/events',
    () => 'session-secret'
  );
  const streams = Array.from({ length: 8 }, (_, index) =>
    connection.listen(index % 2 ? 'general' : 'user-brian')
  );
  const messages = streams.map((stream) => {
    const handler = vi.fn();
    stream.onmessage = handler;
    return handler;
  });
  expect(sockets).toHaveLength(1);
  sockets[0].readyState = 1;
  sockets[0].onopen?.();
  expect(sockets[0].send).toHaveBeenCalledWith(
    JSON.stringify({ type: 'auth', token: 'session-secret' })
  );
  sockets[0].onmessage?.(
    new MessageEvent('message', { data: JSON.stringify({ room: 'general' }) })
  );
  expect(messages[0]).not.toHaveBeenCalled();
  expect(messages[1]).toHaveBeenCalledOnce();
  sockets[0].close();
  await vi.advanceTimersByTimeAsync(2000);
  expect(sockets).toHaveLength(2);
  streams.forEach((stream) => stream.close());
  expect(sockets[1].close).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
