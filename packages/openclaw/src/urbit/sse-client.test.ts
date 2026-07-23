import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UrbitHttpError } from './errors.js';
import { UrbitSSEClient } from './sse-client.js';

// Mock urbitFetch to avoid real network calls
vi.mock('./fetch.js', () => ({
  urbitFetch: vi.fn(),
}));

// Mock channel-ops to avoid real channel operations. connect() calls
// createUrbitChannel + wakeUrbitChannel directly (the old ensureUrbitChannelOpen
// wrapper is no longer used by the client).
vi.mock('./channel-ops.js', () => ({
  createUrbitChannel: vi.fn().mockResolvedValue(undefined),
  wakeUrbitChannel: vi.fn().mockResolvedValue(undefined),
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
      expect(callArgs.signal).toBeUndefined();

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

  describe('poke responses', () => {
    it('does not log successful acknowledgements', () => {
      const log = vi.fn();
      const error = vi.fn();
      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123',
        { logger: { log, error } }
      );

      client.processEvent('data: {"response":"poke","id":123}');

      expect(log).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    });

    it('keeps poke failures observable', () => {
      const log = vi.fn();
      const error = vi.fn();
      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123',
        { logger: { log, error } }
      );

      client.processEvent(
        'data: {"response":"poke","id":123,"err":{"message":"nack"}}'
      );

      expect(log).not.toHaveBeenCalled();
      expect(error).toHaveBeenCalledWith(
        '[SSE] Poke NACK id=123: {"message":"nack"}'
      );
    });
  });

  describe('scry', () => {
    it('forwards optional timeout and abort signal to scryUrbitPath', async () => {
      const { scryUrbitPath } = await import('./channel-ops.js');
      const mockScryUrbitPath = vi.mocked(scryUrbitPath);
      const controller = new AbortController();
      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123'
      );

      await client.scry('/foo.json', {
        timeoutMs: 123,
        signal: controller.signal,
      });

      expect(mockScryUrbitPath).toHaveBeenCalledWith(
        expect.objectContaining({
          baseUrl: 'https://example.com',
          cookie: 'urbauth-~zod=123',
        }),
        {
          path: '/foo.json',
          auditContext: 'tlon-urbit-scry',
          timeoutMs: 123,
          signal: controller.signal,
        }
      );

      await client.scry('/without-options.json');
      expect(mockScryUrbitPath).toHaveBeenLastCalledWith(expect.any(Object), {
        path: '/without-options.json',
        auditContext: 'tlon-urbit-scry',
      });
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
      const { createUrbitChannel } = await import('./channel-ops.js');
      const mockUrbitFetch = vi.mocked(urbitFetch);
      const mockCreate = vi.mocked(createUrbitChannel);
      mockUrbitFetch.mockResolvedValue({
        response: {
          ok: true,
          status: 200,
          body: new ReadableStream({ start() {} }),
        } as unknown as Response,
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

      const createBody = mockCreate.mock.calls.at(-1)?.[1]?.body as
        | Array<{ id: number }>
        | undefined;
      expect(createBody).toBeDefined();
      expect(createBody?.map((sub) => sub.id)).toEqual([2]);
      client.aborted = true;
    });
  });

  describe('resume/rebuild reconnect state machine', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    type ClientPrivates = {
      isConnected: boolean;
      lastHeardEventId: number;
      lastAcknowledgedEventId: number;
      channelEpoch: number;
      channelReaped: boolean;
      streamDownSince: number | null;
      streamController: { abort: () => void } | null;
      streamRelease: (() => Promise<void>) | null;
      attemptReconnect: () => Promise<void>;
      markStreamDown: () => void;
      startStreamWatchdog: () => void;
      stopStreamWatchdog: () => void;
    };
    const priv = (client: UrbitSSEClient) =>
      client as unknown as ClientPrivates;

    // A stream that stays open so processStream blocks instead of hitting its
    // finally and re-triggering the reconnect loop mid-assertion.
    const openStreamResult = () => ({
      response: {
        ok: true,
        status: 200,
        body: new ReadableStream({ start() {} }),
      } as unknown as Response,
      finalUrl: 'https://example.com',
      release: vi.fn().mockResolvedValue(undefined),
    });
    const errorResult = (status: number) => ({
      response: { ok: false, status } as unknown as Response,
      finalUrl: 'https://example.com',
      release: vi.fn().mockResolvedValue(undefined),
    });
    const okPutResult = () => ({
      response: { ok: true, status: 200 },
      finalUrl: 'https://example.com',
      release: vi.fn().mockResolvedValue(undefined),
    });
    const closingStream = () =>
      new ReadableStream({
        start(controller) {
          controller.close();
        },
      });

    it('sends no Last-Event-ID on the first stream GET', async () => {
      const { urbitFetch } = await import('./fetch.js');
      const mockUrbitFetch = vi.mocked(urbitFetch);
      mockUrbitFetch.mockResolvedValue(openStreamResult());

      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123',
        { autoReconnect: false }
      );
      await client.openStream();

      const call = mockUrbitFetch.mock.calls.at(-1)?.[0];
      expect(call?.init?.headers).not.toHaveProperty('Last-Event-ID');
      client.aborted = true;
    });

    it('sends Last-Event-ID from the heard cursor on reconnect (incl. id 0)', async () => {
      const { urbitFetch } = await import('./fetch.js');
      const mockUrbitFetch = vi.mocked(urbitFetch);
      mockUrbitFetch.mockResolvedValue(openStreamResult());

      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123',
        { autoReconnect: false }
      );

      // Hearing id 0 is valid and must be resumed.
      client.processEvent('id: 0\ndata: {"response":"poke","id":1}');
      await client.openStream();
      expect(mockUrbitFetch.mock.calls.at(-1)?.[0].init?.headers).toMatchObject(
        { 'Last-Event-ID': '0' }
      );

      client.processEvent('id: 5\ndata: {"response":"poke","id":2}');
      await client.openStream();
      expect(mockUrbitFetch.mock.calls.at(-1)?.[0].init?.headers).toMatchObject(
        { 'Last-Event-ID': '5' }
      );
      client.aborted = true;
    });

    it('transport-fault reconnect resumes the same channel without recreating', async () => {
      const { urbitFetch } = await import('./fetch.js');
      const { createUrbitChannel } = await import('./channel-ops.js');
      const mockUrbitFetch = vi.mocked(urbitFetch);
      const mockCreate = vi.mocked(createUrbitChannel);
      mockUrbitFetch.mockResolvedValue(openStreamResult());

      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123',
        { streamStaleThresholdMs: 0 }
      );
      await client.subscribe({ app: 'chat', path: '/v4', event: vi.fn() });
      const channelId = client.channelId;
      const epoch = priv(client).channelEpoch;
      priv(client).streamDownSince = Date.now();

      const p = priv(client).attemptReconnect();
      await vi.advanceTimersByTimeAsync(5_000);
      await p;

      expect(client.channelId).toBe(channelId);
      expect(mockCreate).not.toHaveBeenCalled();
      expect(priv(client).channelEpoch).toBe(epoch);
      expect(client.isConnected).toBe(true);

      client.aborted = true;
      priv(client).stopStreamWatchdog();
    });

    it('drops replayed frames without dispatch or ack, then dispatches new ids', async () => {
      const { urbitFetch } = await import('./fetch.js');
      const mockUrbitFetch = vi.mocked(urbitFetch);
      mockUrbitFetch.mockResolvedValue(okPutResult());

      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123'
      );
      const eventHandler = vi.fn();
      await client.subscribe({ app: 'chat', path: '/v4', event: eventHandler });
      mockUrbitFetch.mockClear();

      // Cursor already advanced; a replayed id (<= lastHeard) would cross the
      // ack threshold (20) if it were not dropped.
      priv(client).lastHeardEventId = 100;
      priv(client).lastAcknowledgedEventId = 70;

      client.processEvent('id: 95\ndata: {"id":1,"json":{"n":1}}');
      await Promise.resolve();

      expect(eventHandler).not.toHaveBeenCalled();
      expect(mockUrbitFetch).not.toHaveBeenCalled(); // no ack PUT for a replay
      expect(priv(client).lastHeardEventId).toBe(100);
      expect(priv(client).lastAcknowledgedEventId).toBe(70);

      // A new id dispatches normally.
      client.processEvent('id: 101\ndata: {"id":1,"json":{"n":2}}');
      await Promise.resolve();
      expect(eventHandler).toHaveBeenCalledTimes(1);
      expect(eventHandler).toHaveBeenCalledWith({ n: 2 });
      expect(priv(client).lastHeardEventId).toBe(101);
    });

    it('still acks once the threshold is crossed for new ids', async () => {
      const { urbitFetch } = await import('./fetch.js');
      const mockUrbitFetch = vi.mocked(urbitFetch);
      mockUrbitFetch.mockResolvedValue(okPutResult());

      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123'
      );
      await client.subscribe({ app: 'chat', path: '/v4', event: vi.fn() });
      mockUrbitFetch.mockClear();
      priv(client).lastHeardEventId = 0;
      priv(client).lastAcknowledgedEventId = 0;

      client.processEvent('id: 25\ndata: {"response":"poke","id":1}');
      await Promise.resolve();

      expect(priv(client).lastAcknowledgedEventId).toBe(25);
      const ackCall = mockUrbitFetch.mock.calls.find(
        (call) => call[0].auditContext === 'tlon-urbit-ack'
      );
      expect(ackCall).toBeDefined();
      const body = JSON.parse(ackCall?.[0].init?.body as string);
      expect(body[0]).toMatchObject({ action: 'ack', 'event-id': 25 });
    });

    it.each([404, 410])(
      'stream GET %i reaps the channel and the next attempt rebuilds',
      async (status) => {
        const { urbitFetch } = await import('./fetch.js');
        const { createUrbitChannel } = await import('./channel-ops.js');
        const mockUrbitFetch = vi.mocked(urbitFetch);
        const mockCreate = vi.mocked(createUrbitChannel);
        // First (resume) GET returns the reap status; the rebuild's GET succeeds.
        mockUrbitFetch
          .mockResolvedValueOnce(errorResult(status))
          .mockResolvedValue(openStreamResult());

        const client = new UrbitSSEClient(
          'https://example.com',
          'urbauth-~zod=123',
          { streamStaleThresholdMs: 0 }
        );
        await client.subscribe({ app: 'chat', path: '/v4', event: vi.fn() });
        // Heard events on the old channel; rebuild must reset the cursor.
        client.processEvent('id: 7\ndata: {"response":"poke","id":1}');
        // Seed lastAcknowledgedEventId to a non-default value to prove it resets.
        priv(client).lastAcknowledgedEventId = 5;
        const originalChannelId = client.channelId;
        priv(client).streamDownSince = Date.now();

        const p = priv(client).attemptReconnect();
        await vi.advanceTimersByTimeAsync(20_000);
        await p;

        // A new channel was minted and created with the handler-backed subs.
        expect(client.channelId).not.toBe(originalChannelId);
        expect(mockCreate).toHaveBeenCalledTimes(1);
        const createBody = mockCreate.mock.calls[0][1].body as Array<{
          id: number;
        }>;
        expect(createBody.map((s) => s.id)).toEqual([1]);
        // Epoch bumped, cursors reset.
        expect(priv(client).channelEpoch).toBe(1);
        expect(priv(client).lastHeardEventId).toBe(-1);
        expect(priv(client).lastAcknowledgedEventId).toBe(-1);
        // The rebuild GET carried no Last-Event-ID (cursor was reset).
        const rebuildGet = mockUrbitFetch.mock.calls.at(-1)?.[0];
        expect(rebuildGet?.init?.headers).not.toHaveProperty('Last-Event-ID');

        client.aborted = true;
        priv(client).stopStreamWatchdog();
      }
    );

    it('a stream GET 500 is treated as a dead channel and rebuilds', async () => {
      const { urbitFetch } = await import('./fetch.js');
      const { createUrbitChannel } = await import('./channel-ops.js');
      const mockUrbitFetch = vi.mocked(urbitFetch);
      const mockCreate = vi.mocked(createUrbitChannel);
      // First rebuild's openStream GET 500s (dead channel); the second
      // rebuild's GET succeeds.
      mockUrbitFetch
        .mockResolvedValueOnce(errorResult(500))
        .mockResolvedValue(openStreamResult());

      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123',
        { streamStaleThresholdMs: 0 }
      );
      await client.subscribe({ app: 'chat', path: '/v4', event: vi.fn() });
      const originalChannelId = client.channelId;
      priv(client).channelReaped = true; // force the first attempt to rebuild
      priv(client).streamDownSince = Date.now();

      const p = priv(client).attemptReconnect();
      await vi.advanceTimersByTimeAsync(20_000);
      await p;

      // A 500 on the stream GET is a dead channel (matching @tloncorp/api's
      // seamlessReset() on 500), so it reaps: attempt 1 rebuilds → its GET 500s
      // → attempt 2 rebuilds again → its GET succeeds. Two creates total.
      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(client.channelId).not.toBe(originalChannelId);
      // The successful second create cleared the reap flag.
      expect(priv(client).channelReaped).toBe(false);
      const rebuildGet = mockUrbitFetch.mock.calls.at(-1)?.[0];
      expect(rebuildGet?.path).toContain(client.channelId);

      client.aborted = true;
      priv(client).stopStreamWatchdog();
    });

    it('a wake 404 (Channel activation) does not re-set the reap flag', async () => {
      const { urbitFetch } = await import('./fetch.js');
      const { createUrbitChannel, wakeUrbitChannel } = await import(
        './channel-ops.js'
      );
      const mockUrbitFetch = vi.mocked(urbitFetch);
      const mockCreate = vi.mocked(createUrbitChannel);
      const mockWake = vi.mocked(wakeUrbitChannel);
      // Wake fails with a typed Channel-activation 404 on the rebuild; the
      // following resume succeeds.
      mockWake.mockRejectedValueOnce(
        new UrbitHttpError({ operation: 'Channel activation', status: 404 })
      );
      mockUrbitFetch.mockResolvedValue(openStreamResult());

      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123',
        { streamStaleThresholdMs: 0 }
      );
      await client.subscribe({ app: 'chat', path: '/v4', event: vi.fn() });
      const originalChannelId = client.channelId;
      priv(client).channelReaped = true;
      priv(client).streamDownSince = Date.now();

      const p = priv(client).attemptReconnect();
      await vi.advanceTimersByTimeAsync(20_000);
      await p;

      // The create cleared the flag; the wake 404 (operation 'Channel
      // activation', not 'Stream connection') must NOT re-set it, so the next
      // attempt resumes the created channel instead of re-minting.
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(client.channelId).not.toBe(originalChannelId);
      expect(priv(client).channelReaped).toBe(false);
      const resumeGet = mockUrbitFetch.mock.calls.at(-1)?.[0];
      expect(resumeGet?.path).toContain(client.channelId);

      client.aborted = true;
      priv(client).stopStreamWatchdog();
    });

    it('a pending resubscribe sends its own replacement on resume (recovered)', async () => {
      const { urbitFetch } = await import('./fetch.js');
      const mockUrbitFetch = vi.mocked(urbitFetch);
      mockUrbitFetch.mockResolvedValue(okPutResult());

      const recoverySpy = vi.fn();
      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123',
        { onSubscriptionRecovery: recoverySpy }
      );
      // Queue sub 1 without sending, then mark connected with a known epoch —
      // a resume leaves the epoch unchanged.
      await client.subscribe({
        app: 'chat',
        path: '/v4',
        event: vi.fn(),
        quit: vi.fn(),
      });
      priv(client).isConnected = true;
      priv(client).channelEpoch = 1;
      mockUrbitFetch.mockClear();

      // Gall quit kicks sub 1; resubscribeAfterQuit registers sub 2 (epoch 1).
      client.processEvent('id: 1\ndata: {"id":1,"response":"quit"}');

      // Resume keeps the epoch unchanged, so the loop sends the replacement
      // PUT itself rather than concluding recovered_via_reconnect.
      await vi.advanceTimersByTimeAsync(2_500);

      expect(recoverySpy).toHaveBeenCalledWith(
        expect.objectContaining({ phase: 'recovered' })
      );
      expect(recoverySpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ phase: 'recovered_via_reconnect' })
      );
      const subCall = mockUrbitFetch.mock.calls.find(
        (call) => call[0].init?.method === 'PUT'
      );
      expect(subCall?.[0].path).toContain(client.channelId);
      const body = JSON.parse(subCall?.[0].init?.body as string);
      expect(body[0]).toMatchObject({ action: 'subscribe', id: 2 });
    });

    it('a 404 rebuild resolves a pending resubscribe via epoch bump (no double PUT)', async () => {
      const { urbitFetch } = await import('./fetch.js');
      const mockUrbitFetch = vi.mocked(urbitFetch);
      mockUrbitFetch.mockResolvedValue(openStreamResult());

      const recoverySpy = vi.fn();
      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123',
        { streamStaleThresholdMs: 0, onSubscriptionRecovery: recoverySpy }
      );
      await client.subscribe({
        app: 'chat',
        path: '/v4',
        event: vi.fn(),
        quit: vi.fn(),
      });
      priv(client).isConnected = true;
      priv(client).channelEpoch = 1;

      client.processEvent('id: 1\ndata: {"id":1,"response":"quit"}');
      // Stream drops; the dropped stream GET 404'd → rebuild.
      priv(client).isConnected = false;
      priv(client).channelReaped = true;
      mockUrbitFetch.mockClear();

      priv(client).streamDownSince = Date.now();
      const p = priv(client).attemptReconnect();
      await vi.advanceTimersByTimeAsync(5_000);
      await p;
      // Let the resubscribe loop observe the epoch bump.
      await vi.advanceTimersByTimeAsync(2_500);

      expect(recoverySpy).toHaveBeenCalledWith(
        expect.objectContaining({ phase: 'recovered_via_reconnect' })
      );
      // No duplicate subscribe PUT from the resubscribe loop (the rebuild's
      // createUrbitChannel is mocked, not urbitFetch).
      const subPut = mockUrbitFetch.mock.calls.find(
        (call) =>
          call[0].init?.method === 'PUT' &&
          String(call[0].init?.body ?? '').includes('"subscribe"')
      );
      expect(subPut).toBeUndefined();

      client.aborted = true;
      priv(client).stopStreamWatchdog();
    });

    it('a watchdog-stale teardown resumes the same channel (not a rebuild)', async () => {
      const { urbitFetch } = await import('./fetch.js');
      const { createUrbitChannel } = await import('./channel-ops.js');
      const mockUrbitFetch = vi.mocked(urbitFetch);
      const mockCreate = vi.mocked(createUrbitChannel);
      mockUrbitFetch.mockResolvedValue(openStreamResult());

      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123',
        { streamStaleThresholdMs: 1_000, streamWatchdogIntervalMs: 500 }
      );
      await client.subscribe({ app: 'chat', path: '/v4', event: vi.fn() });
      const channelId = client.channelId;

      priv(client).isConnected = true;
      priv(client).streamController = { abort: vi.fn() };
      priv(client).startStreamWatchdog();

      // Watchdog fires → markStreamDown; channelReaped stays false → resume.
      await vi.advanceTimersByTimeAsync(1_600);
      expect(client.isConnected).toBe(false);
      expect(priv(client).channelReaped).toBe(false);

      // Stop the watchdog (and disable its restart) so the event-less mock
      // stream doesn't trip a second stale teardown during the resume below.
      priv(client).stopStreamWatchdog();
      (
        client as unknown as { streamStaleThresholdMs: number }
      ).streamStaleThresholdMs = 0;

      priv(client).streamDownSince = Date.now();
      const p = priv(client).attemptReconnect();
      await vi.advanceTimersByTimeAsync(5_000);
      await p;

      expect(client.channelId).toBe(channelId);
      expect(mockCreate).not.toHaveBeenCalled();
      expect(client.isConnected).toBe(true);

      client.aborted = true;
      priv(client).stopStreamWatchdog();
    });

    it('poke() rejects after close() and is allowed before the first connect', async () => {
      const { pokeUrbitChannel } = await import('./channel-ops.js');
      const mockPoke = vi.mocked(pokeUrbitChannel);

      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123'
      );

      // Before the first connect: allowed (isConnected is still false).
      await client.poke({ app: 'hood', mark: 'helm-hi', json: {} });
      expect(mockPoke).toHaveBeenCalledTimes(1);

      // After close(): rejected — the channel is unsubscribed/DELETEd.
      client.aborted = true;
      await expect(
        client.poke({ app: 'hood', mark: 'helm-hi', json: {} })
      ).rejects.toThrow(/closed/);
      expect(mockPoke).toHaveBeenCalledTimes(1);
    });

    it('drops isConnected before a slow release settles, then resumes', async () => {
      const { urbitFetch } = await import('./fetch.js');
      const mockUrbitFetch = vi.mocked(urbitFetch);
      mockUrbitFetch.mockResolvedValue(openStreamResult());

      let resolveRelease!: () => void;
      const releasePromise = new Promise<void>((resolve) => {
        resolveRelease = resolve;
      });

      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123',
        { streamStaleThresholdMs: 0 }
      );
      await client.subscribe({ app: 'chat', path: '/v4', event: vi.fn() });
      client.isConnected = true;
      // The stream resource release hangs (slow gateway teardown).
      priv(client).streamRelease = () => releasePromise;

      const p = client.processStream(closingStream());
      await vi.advanceTimersByTimeAsync(1);

      // isConnected flips false BEFORE the slow release await settles
      // (markStreamDown ordering fix).
      expect(client.isConnected).toBe(false);

      resolveRelease();
      await vi.advanceTimersByTimeAsync(5_000);
      await p;

      // Resume succeeded → connected again.
      expect(client.isConnected).toBe(true);
      client.aborted = true;
      priv(client).stopStreamWatchdog();
    });

    it('still reconnects when the stream release rejects', async () => {
      const { urbitFetch } = await import('./fetch.js');
      const mockUrbitFetch = vi.mocked(urbitFetch);
      mockUrbitFetch.mockResolvedValue(openStreamResult());

      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123',
        { streamStaleThresholdMs: 0 }
      );
      await client.subscribe({ app: 'chat', path: '/v4', event: vi.fn() });
      client.isConnected = true;
      priv(client).streamRelease = () =>
        Promise.reject(new Error('release failed'));

      const p = client.processStream(closingStream());
      await vi.advanceTimersByTimeAsync(5_000);
      await p;

      // The rejecting release was swallowed and the reconnect loop still ran
      // (resume → connected) rather than stranding isConnected=true.
      expect(client.isConnected).toBe(true);
      client.aborted = true;
      priv(client).stopStreamWatchdog();
    });

    it('ignores non-numeric event ids (strict parse)', async () => {
      const { urbitFetch } = await import('./fetch.js');
      const mockUrbitFetch = vi.mocked(urbitFetch);
      mockUrbitFetch.mockResolvedValue(openStreamResult());

      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123',
        { autoReconnect: false }
      );
      await client.subscribe({ app: 'chat', path: '/v4', event: vi.fn() });

      // `12x` must NOT become 12; `abc` is not numeric.
      client.processEvent('id: 12x\ndata: {"response":"poke","id":1}');
      client.processEvent('id: abc\ndata: {"response":"poke","id":2}');
      expect(priv(client).lastHeardEventId).toBe(-1);

      await client.openStream();
      expect(
        mockUrbitFetch.mock.calls.at(-1)?.[0].init?.headers
      ).not.toHaveProperty('Last-Event-ID');
      client.aborted = true;
    });

    it('close() during a reconnect backoff emits no telemetry and stays disconnected', async () => {
      const { urbitFetch } = await import('./fetch.js');
      const mockUrbitFetch = vi.mocked(urbitFetch);
      mockUrbitFetch.mockResolvedValue(okPutResult());

      const streamRecoverySpy = vi.fn();
      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123',
        { streamStaleThresholdMs: 0, onStreamRecovery: streamRecoverySpy }
      );

      const p = priv(client).attemptReconnect(); // begins the backoff delay
      await vi.advanceTimersByTimeAsync(0);
      await client.close(); // sets aborted before its awaits
      await vi.advanceTimersByTimeAsync(5_000);
      await p;

      expect(client.isConnected).toBe(false);
      const phases = streamRecoverySpy.mock.calls.map((c) => c[0].phase);
      expect(phases).not.toContain('reconnected');
      expect(phases).not.toContain('reconnect_failed');
    });

    it('close() mid reconnect-attempt aborts the in-flight fetch and emits no telemetry', async () => {
      const { urbitFetch } = await import('./fetch.js');
      const mockUrbitFetch = vi.mocked(urbitFetch);

      const streamRecoverySpy = vi.fn();
      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123',
        { streamStaleThresholdMs: 0, onStreamRecovery: streamRecoverySpy }
      );
      await client.subscribe({ app: 'chat', path: '/v4', event: vi.fn() });

      // The resume's stream GET hangs on a promise we control, so the attempt
      // is driven past the backoff delay and into openStream()'s fetch.
      let rejectStream!: (err: unknown) => void;
      const pendingStream = new Promise<never>((_, reject) => {
        rejectStream = reject;
      });
      mockUrbitFetch
        .mockImplementationOnce(() => pendingStream)
        .mockResolvedValue(okPutResult());

      const p = priv(client).attemptReconnect();
      // Past the 1s backoff and into the try: openStream() awaits pendingStream.
      await vi.advanceTimersByTimeAsync(5_000);

      // close() races the in-flight attempt: flips aborted and aborts the
      // stream controller; its unsubscribe PUT / DELETE resolve via okPutResult.
      const closePromise = client.close();
      // The aborted fetch then rejects (abort-style) once close() set aborted.
      rejectStream(
        new DOMException('The operation was aborted.', 'AbortError')
      );
      await closePromise;
      await p;

      expect(client.isConnected).toBe(false);
      const phases = streamRecoverySpy.mock.calls.map((c) => c[0].phase);
      expect(phases).not.toContain('reconnected');
      expect(phases).not.toContain('reconnect_failed');
    });

    it('close() racing a rebuild never marks the client connected', async () => {
      const { urbitFetch } = await import('./fetch.js');
      const { createUrbitChannel, wakeUrbitChannel } = await import(
        './channel-ops.js'
      );
      const mockUrbitFetch = vi.mocked(urbitFetch);
      const mockCreate = vi.mocked(createUrbitChannel);
      const mockWake = vi.mocked(wakeUrbitChannel);

      const streamRecoverySpy = vi.fn();
      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123',
        { streamStaleThresholdMs: 0, onStreamRecovery: streamRecoverySpy }
      );
      await client.subscribe({ app: 'chat', path: '/v4', event: vi.fn() });

      let resolveCreate!: () => void;
      const createPromise = new Promise<void>((resolve) => {
        resolveCreate = resolve;
      });
      mockCreate.mockImplementation(() => createPromise);

      let resolveWake!: () => void;
      const wakePromise = new Promise<void>((resolve) => {
        resolveWake = resolve;
      });
      mockWake.mockImplementation(() => wakePromise);

      mockUrbitFetch.mockResolvedValue(okPutResult());

      priv(client).channelReaped = true;
      priv(client).streamDownSince = Date.now();

      const p = priv(client).attemptReconnect();
      await vi.advanceTimersByTimeAsync(5_000);

      const closePromise = client.close();
      resolveCreate();
      resolveWake();
      await closePromise;
      await p;

      expect(client.isConnected).toBe(false);
      expect(mockWake).not.toHaveBeenCalled();
      const phases = streamRecoverySpy.mock.calls.map((c) => c[0].phase);
      expect(phases).not.toContain('reconnected');
      expect(phases).not.toContain('reconnect_failed');
    });

    it('clears isConnected when the stream ends even with autoReconnect disabled', async () => {
      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123',
        { autoReconnect: false }
      );
      client.isConnected = true;

      const p = client.processStream(closingStream());
      await vi.advanceTimersByTimeAsync(1);
      await p;

      // No reconnect (autoReconnect off), but the client must not stay marked
      // connected once the stream has ended.
      expect(client.isConnected).toBe(false);
    });

    it('a rejecting release on a 404 stream GET still surfaces the UrbitHttpError and reaps', async () => {
      const { urbitFetch } = await import('./fetch.js');
      const mockUrbitFetch = vi.mocked(urbitFetch);
      // The resume GET 404s AND its release rejects; the rebuild's GET succeeds.
      mockUrbitFetch
        .mockResolvedValueOnce({
          response: { ok: false, status: 404 } as unknown as Response,
          finalUrl: 'https://example.com',
          release: vi.fn().mockRejectedValue(new Error('release failed')),
        })
        .mockResolvedValue(openStreamResult());

      let failureError: unknown;
      let reapedAtFailure = false;
      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123',
        {
          streamStaleThresholdMs: 0,
          onStreamRecovery: (event) => {
            if (event.phase === 'reconnect_failed') {
              failureError = event.error;
              reapedAtFailure = priv(client).channelReaped;
            }
          },
        }
      );
      await client.subscribe({ app: 'chat', path: '/v4', event: vi.fn() });
      const originalChannelId = client.channelId;
      priv(client).streamDownSince = Date.now();

      const p = priv(client).attemptReconnect();
      await vi.advanceTimersByTimeAsync(20_000);
      await p;

      // The rejecting release was swallowed, so the intended 404 surfaced as a
      // Stream-connection UrbitHttpError (not the release rejection)...
      expect(failureError).toBeInstanceOf(UrbitHttpError);
      expect((failureError as UrbitHttpError).status).toBe(404);
      // ...which set channelReaped, so the following attempt rebuilt the channel.
      expect(reapedAtFailure).toBe(true);
      expect(client.channelId).not.toBe(originalChannelId);

      client.aborted = true;
      priv(client).stopStreamWatchdog();
    });

    it('a null/empty response body causes openStream to reject (triggering reconnect)', async () => {
      const { urbitFetch } = await import('./fetch.js');
      const mockUrbitFetch = vi.mocked(urbitFetch);
      const release = vi.fn().mockResolvedValue(undefined);
      mockUrbitFetch.mockResolvedValue({
        response: {
          ok: true,
          status: 200,
          body: null,
        } as unknown as Response,
        finalUrl: 'https://example.com',
        release,
      });

      const client = new UrbitSSEClient(
        'https://example.com',
        'urbauth-~zod=123',
        { autoReconnect: false, streamStaleThresholdMs: 0 }
      );

      // A null body must be rejected at open time (not silently passed to
      // processStream), so the error routes into attemptReconnect's catch.
      await expect(client.openStream()).rejects.toThrow(
        'Stream connection returned no body'
      );
      expect(release).toHaveBeenCalled();
      expect(
        (client as unknown as { streamRelease: unknown }).streamRelease
      ).toBeNull();
    });
  });
});
