import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UrbitSSEClient } from './sse-client.js';

// Mock urbitFetch to avoid real network calls
vi.mock('./fetch.js', () => ({
  urbitFetch: vi.fn(),
}));

// Mock channel-ops to avoid real channel operations
vi.mock('./channel-ops.js', () => ({
  ensureUrbitChannelOpen: vi.fn().mockResolvedValue(undefined),
  pokeUrbitChannel: vi.fn().mockResolvedValue(undefined),
  scryUrbitPath: vi.fn().mockResolvedValue({}),
}));

describe('UrbitSSEClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('subscribe', () => {
    it('sends subscriptions added after connect', async () => {
      const { urbitFetch } = await import('./fetch.js');
      const mockUrbitFetch = vi.mocked(urbitFetch);
      mockUrbitFetch.mockResolvedValue({
        response: { ok: true, status: 200 },
        finalUrl: 'https://example.com',
        release: vi.fn().mockResolvedValue(undefined),
      });

      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123'
      );
      // Simulate connected state
      (client as { isConnected: boolean }).isConnected = true;

      await client.subscribe({
        app: 'chat',
        path: '/dm/~zod',
        event: () => {},
      });

      expect(mockUrbitFetch).toHaveBeenCalledTimes(1);
      const callArgs = mockUrbitFetch.mock.calls[0][0];
      expect(callArgs.path).toContain('/~/channel/');
      expect(callArgs.init.method).toBe('PUT');

      const body = JSON.parse(callArgs.init.body as string);
      expect(body).toHaveLength(1);
      expect(body[0]).toMatchObject({
        action: 'subscribe',
        app: 'chat',
        path: '/dm/~zod',
      });
    });

    it('queues subscriptions before connect', async () => {
      const { urbitFetch } = await import('./fetch.js');
      const mockUrbitFetch = vi.mocked(urbitFetch);

      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123'
      );
      // Not connected yet

      await client.subscribe({
        app: 'chat',
        path: '/dm/~zod',
        event: () => {},
      });

      // Should not call urbitFetch since not connected
      expect(mockUrbitFetch).not.toHaveBeenCalled();
      // But subscription should be queued
      expect(client.subscriptions).toHaveLength(1);
      expect(client.subscriptions[0]).toMatchObject({
        app: 'chat',
        path: '/dm/~zod',
      });
    });
  });

  describe('updateCookie', () => {
    it('normalizes cookie when updating', () => {
      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123'
      );

      // Cookie with extra parts that should be stripped
      client.updateCookie('urbauth-~zod=456; Path=/; HttpOnly');

      expect(client.cookie).toBe('urbauth-~zod=456');
    });

    it('handles simple cookie values', () => {
      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123'
      );

      client.updateCookie('urbauth-~zod=newvalue');

      expect(client.cookie).toBe('urbauth-~zod=newvalue');
    });
  });

  describe('reconnection', () => {
    it('has autoReconnect enabled by default', () => {
      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123'
      );
      expect(client.autoReconnect).toBe(true);
    });

    it('can disable autoReconnect via options', () => {
      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123',
        {
          autoReconnect: false,
        }
      );
      expect(client.autoReconnect).toBe(false);
    });

    it('stores onReconnect callback', () => {
      const onReconnect = vi.fn();
      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123',
        {
          onReconnect,
        }
      );
      expect(client.onReconnect).toBe(onReconnect);
    });

    it('resets reconnect attempts on successful connect', async () => {
      const { urbitFetch } = await import('./fetch.js');
      const mockUrbitFetch = vi.mocked(urbitFetch);

      // Mock a response that returns a readable stream
      const mockStream = new ReadableStream({
        start(controller) {
          controller.close();
        },
      });

      mockUrbitFetch.mockResolvedValue({
        response: {
          ok: true,
          status: 200,
          body: mockStream,
        } as unknown as Response,
        finalUrl: 'https://example.com',
        release: vi.fn().mockResolvedValue(undefined),
      });

      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123',
        {
          autoReconnect: false, // Disable to prevent reconnect loop
        }
      );
      client.reconnectAttempts = 5;

      await client.connect();

      expect(client.reconnectAttempts).toBe(0);
    });
  });

  describe('event acking', () => {
    it('tracks lastHeardEventId and ackThreshold', () => {
      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123'
      );

      // Access private properties for testing
      const lastHeardEventId = (
        client as unknown as { lastHeardEventId: number }
      ).lastHeardEventId;
      const ackThreshold = (client as unknown as { ackThreshold: number })
        .ackThreshold;

      expect(lastHeardEventId).toBe(-1);
      expect(ackThreshold).toBeGreaterThan(0);
    });
  });

  describe('resubscribe after quit', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('resubscribes when a quit event is received', async () => {
      const { urbitFetch } = await import('./fetch.js');
      const mockUrbitFetch = vi.mocked(urbitFetch);
      mockUrbitFetch.mockResolvedValue({
        response: { ok: true, status: 200 },
        finalUrl: 'https://example.com',
        release: vi.fn().mockResolvedValue(undefined),
      });

      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123'
      );
      (client as { isConnected: boolean }).isConnected = true;

      const eventHandler = vi.fn();
      const quitHandler = vi.fn();

      await client.subscribe({
        app: 'channels',
        path: '/v4',
        event: eventHandler,
        quit: quitHandler,
      });

      expect(client.subscriptions).toHaveLength(1);
      mockUrbitFetch.mockClear();

      // Simulate a quit event from the server
      mockUrbitFetch.mockResolvedValue({
        response: { ok: true, status: 200 },
        finalUrl: 'https://example.com',
        release: vi.fn().mockResolvedValue(undefined),
      });

      client.processEvent('id: 1\ndata: {"id":1,"response":"quit"}');

      expect(quitHandler).toHaveBeenCalledTimes(1);

      // Wait for the resubscription (2s initial backoff)
      await vi.advanceTimersByTimeAsync(2100);

      // Should have sent a new subscribe request
      expect(mockUrbitFetch).toHaveBeenCalledTimes(1);
      const body = JSON.parse(
        mockUrbitFetch.mock.calls[0][0].init.body as string
      );
      expect(body[0]).toMatchObject({
        action: 'subscribe',
        app: 'channels',
        path: '/v4',
      });
      // New sub ID should be 2
      expect(body[0].id).toBe(2);
      expect(client.subscriptions).toHaveLength(2);
    });

    it('does not resubscribe if client is aborted', async () => {
      const { urbitFetch } = await import('./fetch.js');
      const mockUrbitFetch = vi.mocked(urbitFetch);
      mockUrbitFetch.mockResolvedValue({
        response: { ok: true, status: 200 },
        finalUrl: 'https://example.com',
        release: vi.fn().mockResolvedValue(undefined),
      });

      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123'
      );
      (client as { isConnected: boolean }).isConnected = true;

      await client.subscribe({
        app: 'channels',
        path: '/v4',
        event: vi.fn(),
        quit: vi.fn(),
      });

      mockUrbitFetch.mockClear();

      // Abort before quit
      client.aborted = true;
      client.processEvent('id: 1\ndata: {"id":1,"response":"quit"}');

      await vi.advanceTimersByTimeAsync(5000);

      expect(mockUrbitFetch).not.toHaveBeenCalled();
    });
  });

  describe('constructor', () => {
    it('generates unique channel ID', () => {
      const client1 = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123'
      );
      const client2 = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123'
      );

      expect(client1.channelId).not.toBe(client2.channelId);
    });

    it('normalizes cookie in constructor', () => {
      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123; Path=/; HttpOnly'
      );

      expect(client.cookie).toBe('urbauth-~zod=123');
    });

    it('sets default reconnection parameters', () => {
      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123'
      );

      expect(client.maxReconnectAttempts).toBe(10);
      expect(client.reconnectDelay).toBe(1000);
      expect(client.maxReconnectDelay).toBe(30000);
    });

    it('allows overriding reconnection parameters', () => {
      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123',
        {
          maxReconnectAttempts: 5,
          reconnectDelay: 500,
          maxReconnectDelay: 10000,
        }
      );

      expect(client.maxReconnectAttempts).toBe(5);
      expect(client.reconnectDelay).toBe(500);
      expect(client.maxReconnectDelay).toBe(10000);
    });
  });

  describe('resubscribe resilience', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const okFetchResult = () => ({
      response: { ok: true, status: 200 },
      finalUrl: 'https://example.com',
      release: vi.fn().mockResolvedValue(undefined),
    });

    it('keeps retrying resubscription beyond five failed attempts', async () => {
      const { urbitFetch } = await import('./fetch.js');
      const mockUrbitFetch = vi.mocked(urbitFetch);
      mockUrbitFetch.mockResolvedValue(okFetchResult());

      const recoverySpy = vi.fn();
      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123',
        { onSubscriptionRecovery: recoverySpy }
      );
      (client as { isConnected: boolean }).isConnected = true;

      await client.subscribe({
        app: 'chat',
        path: '/v4',
        event: vi.fn(),
        quit: vi.fn(),
      });
      mockUrbitFetch.mockClear();
      mockUrbitFetch.mockRejectedValue(new Error('node unresponsive'));

      client.processEvent('id: 1\ndata: {"id":1,"response":"quit"}');

      // Backoff waits: 2s, 4s, 8s, 16s, 30s, 30s... The old implementation
      // gave up permanently after 5 attempts (~62s).
      await vi.advanceTimersByTimeAsync(125_000);
      expect(mockUrbitFetch.mock.calls.length).toBeGreaterThanOrEqual(6);
      expect(recoverySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          app: 'chat',
          path: '/v4',
          phase: 'retrying',
          attempt: 1,
        })
      );
      expect(recoverySpy).toHaveBeenCalledWith(
        expect.objectContaining({ phase: 'retrying', attempt: 5 })
      );

      // Node comes back: the next attempt succeeds and reports recovery
      // with the total downtime so PostHog can aggregate outage duration.
      mockUrbitFetch.mockResolvedValue(okFetchResult());
      await vi.advanceTimersByTimeAsync(31_000);
      const recovered = recoverySpy.mock.calls
        .map((call) => call[0])
        .find((event) => event.phase === 'recovered');
      expect(recovered).toBeDefined();
      expect(recovered.downMs).toBeGreaterThan(0);
    });

    it('completes a pending resubscribe via stream reconnect instead of double-subscribing', async () => {
      const { urbitFetch } = await import('./fetch.js');
      const mockUrbitFetch = vi.mocked(urbitFetch);
      mockUrbitFetch.mockResolvedValue(okFetchResult());

      const recoverySpy = vi.fn();
      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123',
        { onSubscriptionRecovery: recoverySpy }
      );
      (client as { isConnected: boolean }).isConnected = true;

      await client.subscribe({
        app: 'chat',
        path: '/v4',
        event: vi.fn(),
        quit: vi.fn(),
      });
      mockUrbitFetch.mockClear();

      client.processEvent('id: 1\ndata: {"id":1,"response":"quit"}');
      // Stream drops before the first resubscribe attempt fires.
      (client as { isConnected: boolean }).isConnected = false;

      await vi.advanceTimersByTimeAsync(4_500);
      // Disconnected: no subscribe PUTs, but the loop must stay alive
      // (the old implementation returned here and never recovered).
      expect(mockUrbitFetch).not.toHaveBeenCalled();

      // Stream reconnects: connect() recreates the channel with the pending
      // subscription included and bumps the epoch.
      (client as unknown as { channelEpoch: number }).channelEpoch += 1;
      (client as { isConnected: boolean }).isConnected = true;

      await vi.advanceTimersByTimeAsync(2_500);
      expect(mockUrbitFetch).not.toHaveBeenCalled();
      expect(recoverySpy).toHaveBeenCalledWith(
        expect.objectContaining({ phase: 'recovered_via_reconnect' })
      );
    });
  });

  describe('stream staleness watchdog', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('notifies handlers and aborts a stale stream', async () => {
      const streamRecoverySpy = vi.fn();
      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123',
        {
          streamStaleThresholdMs: 1_000,
          streamWatchdogIntervalMs: 500,
          onStreamRecovery: streamRecoverySpy,
        }
      );
      const errSpy = vi.fn();
      await client.subscribe({
        app: 'chat',
        path: '/v4',
        event: vi.fn(),
        err: errSpy,
      });

      const abortSpy = vi.fn();
      (client as { isConnected: boolean }).isConnected = true;
      (
        client as unknown as { streamController: { abort: () => void } }
      ).streamController = { abort: abortSpy };
      (
        client as unknown as { startStreamWatchdog: () => void }
      ).startStreamWatchdog();

      await vi.advanceTimersByTimeAsync(1_600);

      expect(abortSpy).toHaveBeenCalledTimes(1);
      expect(errSpy).toHaveBeenCalledTimes(1);
      const staleError = errSpy.mock.calls[0][0] as Error;
      expect(String(staleError.message)).toContain('stale');
      // Watchdog fire must reach the stream-recovery hook (→ PostHog),
      // not just handler err fan-out.
      expect(streamRecoverySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'watchdog_stale',
          idleMs: expect.any(Number),
        })
      );

      // The abort tears the stream down (isConnected flips false) and the
      // reconnect loop owns recovery; the watchdog must not keep firing.
      (client as { isConnected: boolean }).isConnected = false;
      await vi.advanceTimersByTimeAsync(3_000);
      expect(abortSpy).toHaveBeenCalledTimes(1);

      (
        client as unknown as { stopStreamWatchdog: () => void }
      ).stopStreamWatchdog();
    });

    it('does not fire while events are flowing', async () => {
      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123',
        { streamStaleThresholdMs: 1_000, streamWatchdogIntervalMs: 500 }
      );
      const errSpy = vi.fn();
      await client.subscribe({
        app: 'chat',
        path: '/v4',
        event: vi.fn(),
        err: errSpy,
      });

      const abortSpy = vi.fn();
      (client as { isConnected: boolean }).isConnected = true;
      (
        client as unknown as { streamController: { abort: () => void } }
      ).streamController = { abort: abortSpy };
      (
        client as unknown as { startStreamWatchdog: () => void }
      ).startStreamWatchdog();

      // Keep traffic flowing (like the 30s heartbeat poke acks in prod).
      for (let i = 0; i < 5; i += 1) {
        await vi.advanceTimersByTimeAsync(400);
        client.processEvent(`id: ${i}\ndata: {"response":"poke","id":${i}}`);
      }

      expect(abortSpy).not.toHaveBeenCalled();
      expect(errSpy).not.toHaveBeenCalled();

      (
        client as unknown as { stopStreamWatchdog: () => void }
      ).stopStreamWatchdog();
    });
  });

  describe('stream reconnect observability', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('reports downtime once the stream reconnects', async () => {
      const { urbitFetch } = await import('./fetch.js');
      const mockUrbitFetch = vi.mocked(urbitFetch);
      // A stream that stays open (like a real SSE connection) so
      // processStream's for-await blocks instead of hitting the finally and
      // re-triggering reconnect.
      const mockStream = new ReadableStream({ start() {} });
      mockUrbitFetch.mockResolvedValue({
        response: {
          ok: true,
          status: 200,
          body: mockStream,
        } as unknown as Response,
        finalUrl: 'https://example.com',
        release: vi.fn().mockResolvedValue(undefined),
      });

      const streamRecoverySpy = vi.fn();
      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123',
        {
          streamStaleThresholdMs: 0, // disable watchdog for this test
          onStreamRecovery: streamRecoverySpy,
        }
      );
      await client.subscribe({ app: 'chat', path: '/v4', event: vi.fn() });

      // Simulate a stream that has been down for a while, then reconnect.
      (client as unknown as { streamDownSince: number }).streamDownSince =
        Date.now() - 42_000;
      client.reconnectAttempts = 2;

      // attemptReconnect awaits an internal backoff timer, so pump timers
      // while it's in flight rather than awaiting it directly.
      const reconnectPromise = (
        client as unknown as { attemptReconnect: () => Promise<void> }
      ).attemptReconnect();
      await vi.advanceTimersByTimeAsync(5_000);
      await reconnectPromise;

      const reconnected = streamRecoverySpy.mock.calls
        .map((call) => call[0])
        .find((event) => event.phase === 'reconnected');
      expect(reconnected).toBeDefined();
      expect(reconnected.downtimeMs).toBeGreaterThanOrEqual(42_000);
      // Attempt count is captured before connect() resets it.
      expect(reconnected.attempt).toBe(3);

      // Stop further reconnects without a full close() — the shared mock
      // stream is locked by the live reader, so cancel() would throw.
      client.aborted = true;
      (
        client as unknown as { stopStreamWatchdog: () => void }
      ).stopStreamWatchdog();
    });
  });

  describe('reconnect subscription hygiene', () => {
    it('recreates only handler-backed subscriptions on connect', async () => {
      const { urbitFetch } = await import('./fetch.js');
      const { ensureUrbitChannelOpen } = await import('./channel-ops.js');
      const mockUrbitFetch = vi.mocked(urbitFetch);
      const mockEnsure = vi.mocked(ensureUrbitChannelOpen);
      mockUrbitFetch.mockResolvedValue({
        response: { ok: true, status: 200, body: null },
        finalUrl: 'https://example.com',
        release: vi.fn().mockResolvedValue(undefined),
      });

      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123',
        { streamStaleThresholdMs: 0 }
      );
      await client.subscribe({ app: 'chat', path: '/v4', event: vi.fn() });
      await client.subscribe({ app: 'channels', path: '/v4', event: vi.fn() });
      // Simulate a quit-kicked subscription whose handlers were removed.
      client.eventHandlers.delete(1);

      await client.connect();

      const createBody = mockEnsure.mock.calls.at(-1)?.[1]?.createBody as
        | Array<{ id: number }>
        | undefined;
      expect(createBody).toBeDefined();
      expect(createBody?.map((sub) => sub.id)).toEqual([2]);
    });
  });
});
