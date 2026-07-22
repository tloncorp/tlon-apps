import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import type { LookupFn, SsrFPolicy } from 'openclaw/plugin-sdk/ssrf-runtime';

import {
  ensureUrbitChannelOpen,
  pokeUrbitChannel,
  scryUrbitPath,
} from './channel-ops.js';
import { getUrbitContext, normalizeUrbitCookie } from './context.js';
import { urbitFetch } from './fetch.js';

export type UrbitSseLogger = {
  log?: (message: string) => void;
  error?: (message: string) => void;
};

export type SubscriptionRecoveryEvent = {
  app: string;
  path: string;
  phase: 'retrying' | 'recovered' | 'recovered_via_reconnect';
  /** Failed resubscribe attempts so far (0 on a clean first-try recovery). */
  attempt: number;
  /** Elapsed ms since the quit that killed the subscription. */
  downMs: number;
  error?: unknown;
};

export type StreamRecoveryEvent = {
  phase: 'watchdog_stale' | 'reconnect_failed' | 'reconnected';
  /** Reconnect attempts so far (0 for watchdog_stale). */
  attempt: number;
  /** watchdog_stale: how long the stream had been silent. */
  idleMs?: number;
  /** reconnected: how long the stream was down. */
  downtimeMs?: number;
  error?: unknown;
};

type UrbitSseOptions = {
  ship?: string;
  ssrfPolicy?: SsrFPolicy;
  lookupFn?: LookupFn;
  fetchImpl?: (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => Promise<Response>;
  onReconnect?: (client: UrbitSSEClient) => Promise<void> | void;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  maxReconnectDelay?: number;
  logger?: UrbitSseLogger;
  /** Observability hook for post-quit resubscribe recovery progress. */
  onSubscriptionRecovery?: (event: SubscriptionRecoveryEvent) => void;
  /** Observability hook for stream-level drops, reconnects, and stalls. */
  onStreamRecovery?: (event: StreamRecoveryEvent) => void;
  /**
   * Force a stream reconnect when no SSE event (facts, poke acks, ...) has
   * arrived for this long. In production the gateway-status heartbeat acks
   * give the stream a ~30s pulse, so a long silence means the socket is
   * dead even though no error or EOF was ever surfaced. 0 disables.
   */
  streamStaleThresholdMs?: number;
  streamWatchdogIntervalMs?: number;
};

export class UrbitSSEClient {
  url: string;
  cookie: string;
  ship: string;
  channelId: string;
  channelUrl: string;
  subscriptions: Array<{
    id: number;
    action: 'subscribe';
    ship: string;
    app: string;
    path: string;
  }> = [];
  eventHandlers = new Map<
    number,
    {
      event?: (data: unknown) => void;
      err?: (error: unknown) => void;
      quit?: () => void;
    }
  >();
  aborted = false;
  streamController: AbortController | null = null;
  onReconnect: UrbitSseOptions['onReconnect'] | null;
  autoReconnect: boolean;
  reconnectAttempts = 0;
  maxReconnectAttempts: number;
  reconnectDelay: number;
  maxReconnectDelay: number;
  isConnected = false;
  logger: UrbitSseLogger;
  ssrfPolicy?: SsrFPolicy;
  lookupFn?: LookupFn;
  fetchImpl?: (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => Promise<Response>;
  streamRelease: (() => Promise<void>) | null = null;

  // Event ack tracking - must ack every ~50 events to keep channel healthy
  private lastHeardEventId = -1;
  private lastAcknowledgedEventId = -1;
  private readonly ackThreshold = 20;

  /**
   * Incremented on every successful connect(). A pending post-quit
   * resubscribe watches this: a bump means the new eyre channel was created
   * with the full subscription list (see connect), so the pending sub is
   * already live and sending it again would double-subscribe.
   */
  private channelEpoch = 0;
  private lastEventAt = Date.now();
  private streamDownSince: number | null = null;
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private suppressNextStreamErrorFanout = false;
  private onSubscriptionRecovery: UrbitSseOptions['onSubscriptionRecovery'];
  private onStreamRecovery: UrbitSseOptions['onStreamRecovery'];
  private streamStaleThresholdMs: number;
  private streamWatchdogIntervalMs: number;

  constructor(url: string, cookie: string, options: UrbitSseOptions = {}) {
    const ctx = getUrbitContext(url, options.ship);
    this.url = ctx.baseUrl;
    this.cookie = normalizeUrbitCookie(cookie);
    this.ship = ctx.ship;
    this.channelId = `${Math.floor(Date.now() / 1000)}-${randomUUID().slice(0, 8)}`;
    this.channelUrl = new URL(
      `/~/channel/${this.channelId}`,
      this.url
    ).toString();
    this.onReconnect = options.onReconnect ?? null;
    this.autoReconnect = options.autoReconnect !== false;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 10;
    this.reconnectDelay = options.reconnectDelay ?? 1000;
    this.maxReconnectDelay = options.maxReconnectDelay ?? 30000;
    this.logger = options.logger ?? {};
    this.ssrfPolicy = options.ssrfPolicy;
    this.lookupFn = options.lookupFn;
    this.fetchImpl = options.fetchImpl;
    this.onSubscriptionRecovery = options.onSubscriptionRecovery;
    this.onStreamRecovery = options.onStreamRecovery;
    this.streamStaleThresholdMs = options.streamStaleThresholdMs ?? 180_000;
    this.streamWatchdogIntervalMs = options.streamWatchdogIntervalMs ?? 30_000;
  }

  async subscribe(params: {
    app: string;
    path: string;
    event?: (data: unknown) => void;
    err?: (error: unknown) => void;
    quit?: () => void;
  }) {
    const subId = this.subscriptions.length + 1;
    const subscription = {
      id: subId,
      action: 'subscribe',
      ship: this.ship,
      app: params.app,
      path: params.path,
    } as const;

    this.subscriptions.push(subscription);
    this.eventHandlers.set(subId, {
      event: params.event,
      err: params.err,
      quit: params.quit,
    });

    if (this.isConnected) {
      try {
        await this.sendSubscription(subscription);
      } catch (error) {
        const handler = this.eventHandlers.get(subId);
        handler?.err?.(error);
      }
    }
    return subId;
  }

  private async sendSubscription(subscription: {
    id: number;
    action: 'subscribe';
    ship: string;
    app: string;
    path: string;
  }) {
    const { response, release } = await urbitFetch({
      baseUrl: this.url,
      path: `/~/channel/${this.channelId}`,
      init: {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: this.cookie,
        },
        body: JSON.stringify([subscription]),
      },
      ssrfPolicy: this.ssrfPolicy,
      lookupFn: this.lookupFn,
      fetchImpl: this.fetchImpl,
      timeoutMs: 30_000,
      auditContext: 'tlon-urbit-subscribe',
    });

    try {
      if (!response.ok && response.status !== 204) {
        const errorText = await response.text().catch(() => '');
        throw new Error(
          `Subscribe failed: ${response.status}${errorText ? ` - ${errorText}` : ''}`
        );
      }
    } finally {
      await release();
    }
  }

  async connect() {
    await ensureUrbitChannelOpen(
      {
        baseUrl: this.url,
        cookie: this.cookie,
        ship: this.ship,
        channelId: this.channelId,
        ssrfPolicy: this.ssrfPolicy,
        lookupFn: this.lookupFn,
        fetchImpl: this.fetchImpl,
      },
      {
        // Only recreate subscriptions that still have handlers. Entries whose
        // handlers were removed (e.g. replaced after a gall quit) would
        // otherwise double-subscribe and double-deliver after a reconnect.
        createBody: this.subscriptions.filter((sub) =>
          this.eventHandlers.has(sub.id)
        ),
        createAuditContext: 'tlon-urbit-channel-create',
      }
    );

    await this.openStream();
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.channelEpoch += 1;
    this.lastEventAt = Date.now();
    this.startStreamWatchdog();
  }

  async openStream() {
    // Use AbortController with manual timeout so we only abort during initial connection,
    // not after the SSE stream is established and actively streaming.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);

    this.streamController = controller;

    const { response, release } = await urbitFetch({
      baseUrl: this.url,
      path: `/~/channel/${this.channelId}`,
      init: {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          Cookie: this.cookie,
        },
      },
      ssrfPolicy: this.ssrfPolicy,
      lookupFn: this.lookupFn,
      fetchImpl: this.fetchImpl,
      signal: controller.signal,
      auditContext: 'tlon-urbit-sse-stream',
    });

    this.streamRelease = release;

    // Clear timeout once connection established (headers received).
    clearTimeout(timeoutId);

    if (!response.ok) {
      await release();
      this.streamRelease = null;
      throw new Error(`Stream connection failed: ${response.status}`);
    }

    this.processStream(response.body).catch((error) => {
      if (this.suppressNextStreamErrorFanout) {
        // The stale-stream watchdog already notified handlers with a
        // descriptive error before aborting; don't fan out the raw
        // AbortError too.
        this.suppressNextStreamErrorFanout = false;
        this.logger.log?.(
          `[SSE] Stream torn down by watchdog: ${String(error)}`
        );
        return;
      }
      if (!this.aborted) {
        this.logger.error?.(`Stream error: ${String(error)}`);
        for (const { err } of this.eventHandlers.values()) {
          if (err) {
            err(error);
          }
        }
      }
    });
  }

  async processStream(body: ReadableStream<Uint8Array> | Readable | null) {
    if (!body) {
      return;
    }
    // oxlint-disable-next-line typescript/no-explicit-any
    const stream =
      body instanceof ReadableStream ? Readable.fromWeb(body as any) : body;
    let buffer = '';

    try {
      for await (const chunk of stream) {
        if (this.aborted) {
          break;
        }
        buffer += chunk.toString();
        let eventEnd;
        while ((eventEnd = buffer.indexOf('\n\n')) !== -1) {
          const eventData = buffer.substring(0, eventEnd);
          buffer = buffer.substring(eventEnd + 2);
          this.processEvent(eventData);
        }
      }
    } finally {
      if (this.streamRelease) {
        const release = this.streamRelease;
        this.streamRelease = null;
        await release();
      }
      this.streamController = null;
      if (!this.aborted && this.autoReconnect) {
        this.isConnected = false;
        this.streamDownSince ??= Date.now();
        this.logger.log?.('[SSE] Stream ended, attempting reconnection...');
        await this.attemptReconnect();
      }
    }
  }

  processEvent(eventData: string) {
    this.lastEventAt = Date.now();
    const lines = eventData.split('\n');
    let data: string | null = null;
    let eventId: number | null = null;

    for (const line of lines) {
      if (line.startsWith('id: ')) {
        eventId = parseInt(line.substring(4), 10);
      }
      if (line.startsWith('data: ')) {
        data = line.substring(6);
      }
    }

    if (!data) {
      return;
    }

    // Track event ID and send ack if needed
    if (eventId !== null && !isNaN(eventId)) {
      if (eventId > this.lastHeardEventId) {
        this.lastHeardEventId = eventId;
        if (eventId - this.lastAcknowledgedEventId > this.ackThreshold) {
          this.logger.log?.(
            `[SSE] Acking event ${eventId} (last acked: ${this.lastAcknowledgedEventId})`
          );
          this.ack(eventId).catch((err) => {
            this.logger.error?.(
              `Failed to ack event ${eventId}: ${String(err)}`
            );
          });
        }
      }
    }

    try {
      const parsed = JSON.parse(data) as {
        id?: number;
        json?: unknown;
        response?: string;
        ok?: string;
        err?: unknown;
      };

      // Log poke ack/nack responses (normally silent — critical for debugging DM delivery issues)
      if (parsed.response === 'poke') {
        if (parsed.err) {
          this.logger.error?.(
            `[SSE] Poke NACK id=${parsed.id}: ${JSON.stringify(parsed.err)}`
          );
        } else {
          this.logger.log?.(`[SSE] Poke ack id=${parsed.id}`);
        }
        return;
      }

      if (parsed.response === 'quit') {
        if (parsed.id) {
          const handlers = this.eventHandlers.get(parsed.id);
          if (handlers?.quit) {
            handlers.quit();
          }
          // Auto-resubscribe after the agent kicks us
          void this.resubscribeAfterQuit(parsed.id);
        }
        return;
      }

      if (parsed.id && this.eventHandlers.has(parsed.id)) {
        const { event } = this.eventHandlers.get(parsed.id) ?? {};
        if (event && parsed.json) {
          event(parsed.json);
        }
      } else if (parsed.json) {
        for (const { event } of this.eventHandlers.values()) {
          if (event) {
            event(parsed.json);
          }
        }
      }
    } catch (error) {
      this.logger.error?.(`Error parsing SSE event: ${String(error)}`);
    }
  }

  async poke(params: { app: string; mark: string; json: unknown }) {
    return await pokeUrbitChannel(
      {
        baseUrl: this.url,
        cookie: this.cookie,
        ship: this.ship,
        channelId: this.channelId,
        ssrfPolicy: this.ssrfPolicy,
        lookupFn: this.lookupFn,
        fetchImpl: this.fetchImpl,
      },
      { ...params, auditContext: 'tlon-urbit-poke' }
    );
  }

  async scry(
    path: string,
    opts?: { timeoutMs?: number; signal?: AbortSignal }
  ) {
    return await scryUrbitPath(
      {
        baseUrl: this.url,
        cookie: this.cookie,
        ssrfPolicy: this.ssrfPolicy,
        lookupFn: this.lookupFn,
        fetchImpl: this.fetchImpl,
      },
      { path, auditContext: 'tlon-urbit-scry', ...opts }
    );
  }

  /**
   * Update the cookie used for authentication.
   * Call this when re-authenticating after session expiry.
   */
  updateCookie(newCookie: string): void {
    this.cookie = normalizeUrbitCookie(newCookie);
  }

  private async ack(eventId: number): Promise<void> {
    this.lastAcknowledgedEventId = eventId;

    const ackData = {
      id: Date.now(),
      action: 'ack',
      'event-id': eventId,
    };

    const { response, release } = await urbitFetch({
      baseUrl: this.url,
      path: `/~/channel/${this.channelId}`,
      init: {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: this.cookie,
        },
        body: JSON.stringify([ackData]),
      },
      ssrfPolicy: this.ssrfPolicy,
      lookupFn: this.lookupFn,
      fetchImpl: this.fetchImpl,
      timeoutMs: 10_000,
      auditContext: 'tlon-urbit-ack',
    });

    try {
      if (!response.ok) {
        throw new Error(`Ack failed with status ${response.status}`);
      }
    } finally {
      await release();
    }
  }

  async attemptReconnect() {
    if (this.aborted || !this.autoReconnect) {
      this.logger.log?.('[SSE] Reconnection aborted or disabled');
      return;
    }

    // If we've hit max attempts, wait longer then reset and keep trying
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.log?.(
        `[SSE] Max reconnection attempts (${this.maxReconnectAttempts}) reached. Waiting 10s before resetting...`
      );
      // Wait 10 seconds before resetting and trying again
      const extendedBackoff = 10000; // 10 seconds
      await new Promise((resolve) => setTimeout(resolve, extendedBackoff));
      this.reconnectAttempts = 0; // Reset counter to continue trying
      this.logger.log?.(
        '[SSE] Reconnection attempts reset, resuming reconnection...'
      );
    }

    this.reconnectAttempts += 1;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    this.logger.log?.(
      `[SSE] Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`
    );

    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      this.channelId = `${Math.floor(Date.now() / 1000)}-${randomUUID().slice(0, 8)}`;
      this.channelUrl = new URL(
        `/~/channel/${this.channelId}`,
        this.url
      ).toString();

      if (this.onReconnect) {
        await this.onReconnect(this);
      }

      // connect() resets the attempt counter on success; capture it first.
      const attempt = this.reconnectAttempts;
      await this.connect();
      this.logger.log?.('[SSE] Reconnection successful!');
      const downtimeMs = this.streamDownSince
        ? Date.now() - this.streamDownSince
        : undefined;
      this.streamDownSince = null;
      this.onStreamRecovery?.({
        phase: 'reconnected',
        attempt,
        downtimeMs,
      });
    } catch (error) {
      this.logger.error?.(`[SSE] Reconnection failed: ${String(error)}`);
      this.onStreamRecovery?.({
        phase: 'reconnect_failed',
        attempt: this.reconnectAttempts,
        error,
      });
      await this.attemptReconnect();
    }
  }

  /**
   * Watchdog for the silent-death failure mode: the socket hangs without an
   * error or EOF, so processStream blocks forever and no reconnect fires.
   * When no SSE event has arrived for streamStaleThresholdMs, notify
   * handlers with a descriptive error and abort the stream, which routes
   * into the normal auto-reconnect path (fresh channel, all live
   * subscriptions recreated).
   */
  private startStreamWatchdog() {
    if (
      this.watchdogTimer ||
      !this.autoReconnect ||
      this.streamStaleThresholdMs <= 0
    ) {
      return;
    }
    this.watchdogTimer = setInterval(() => {
      if (this.aborted) {
        this.stopStreamWatchdog();
        return;
      }
      if (!this.isConnected) {
        // Reconnect loop owns recovery while the stream is down.
        return;
      }
      const idleMs = Date.now() - this.lastEventAt;
      if (idleMs < this.streamStaleThresholdMs) {
        return;
      }
      this.logger.error?.(
        `[SSE] Stream stale: no events for ${Math.round(idleMs / 1000)}s (threshold ${Math.round(this.streamStaleThresholdMs / 1000)}s); forcing reconnect`
      );
      this.onStreamRecovery?.({ phase: 'watchdog_stale', attempt: 0, idleMs });
      const staleError = new Error(
        `SSE stream stale: no events for ${Math.round(idleMs / 1000)}s; forcing reconnect`
      );
      for (const { err } of this.eventHandlers.values()) {
        err?.(staleError);
      }
      // Reset so the watchdog doesn't refire while the teardown/reconnect
      // is still in flight.
      this.lastEventAt = Date.now();
      this.streamDownSince ??= Date.now();
      this.suppressNextStreamErrorFanout = true;
      this.streamController?.abort();
    }, this.streamWatchdogIntervalMs);
    if (typeof this.watchdogTimer === 'object') {
      this.watchdogTimer.unref?.();
    }
  }

  private stopStreamWatchdog() {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  /**
   * Re-subscribe to an app/path after the Gall agent sends a quit.
   * Creates a new subscription with a fresh ID, transfers event handlers,
   * and retries with capped exponential backoff until it succeeds, the
   * client closes, or a stream-level reconnect recreates the channel with
   * the new subscription already included. A dead inbound subscription is
   * unrecoverable data loss for the bot, so this never gives up on its own.
   */
  private async resubscribeAfterQuit(oldSubId: number) {
    const oldSub = this.subscriptions.find((s) => s.id === oldSubId);
    if (!oldSub || this.aborted) return;

    const handlers = this.eventHandlers.get(oldSubId);
    if (!handlers) return;

    const baseDelay = 2000;
    const maxDelay = 30000;

    // Register the replacement once, up front. From this point the sub is
    // part of this.subscriptions, so any connect() (stream reconnect)
    // creates it as part of the new channel — tracked via channelEpoch.
    const newSubId = this.subscriptions.length + 1;
    const newSub = {
      id: newSubId,
      action: 'subscribe' as const,
      ship: this.ship,
      app: oldSub.app,
      path: oldSub.path,
    };
    this.subscriptions.push(newSub);
    this.eventHandlers.set(newSubId, handlers);
    this.eventHandlers.delete(oldSubId);
    const epochAtRegistration = this.channelEpoch;
    const downSince = Date.now();

    let failedAttempts = 0;
    for (;;) {
      const delay = Math.min(
        baseDelay * Math.pow(2, Math.min(failedAttempts, 4)),
        maxDelay
      );
      this.logger.log?.(
        `[SSE] Resubscribing to ${oldSub.app}${oldSub.path} after quit (attempt ${failedAttempts + 1}) in ${delay}ms...`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));

      if (this.aborted) return;

      if (this.channelEpoch !== epochAtRegistration) {
        // A stream reconnect rebuilt the channel with newSub included;
        // sending it again would double-subscribe.
        this.logger.log?.(
          `[SSE] Subscription ${oldSub.app}${oldSub.path} recovered via stream reconnect (id=${newSubId})`
        );
        this.onSubscriptionRecovery?.({
          app: oldSub.app,
          path: oldSub.path,
          phase: 'recovered_via_reconnect',
          attempt: failedAttempts,
          downMs: Date.now() - downSince,
        });
        return;
      }

      if (!this.isConnected) {
        // Stream is down; the reconnect loop owns recovery. Keep waiting —
        // the epoch check above completes this resubscribe when it lands.
        continue;
      }

      try {
        await this.sendSubscription(newSub);
        this.logger.log?.(
          `[SSE] Resubscribed to ${oldSub.app}${oldSub.path} successfully (new id=${newSubId})`
        );
        this.onSubscriptionRecovery?.({
          app: oldSub.app,
          path: oldSub.path,
          phase: 'recovered',
          attempt: failedAttempts,
          downMs: Date.now() - downSince,
        });
        return;
      } catch (error) {
        failedAttempts += 1;
        this.logger.error?.(
          `[SSE] Resubscribe failed for ${oldSub.app}${oldSub.path} (attempt ${failedAttempts}): ${String(error)}`
        );
        this.onSubscriptionRecovery?.({
          app: oldSub.app,
          path: oldSub.path,
          phase: 'retrying',
          attempt: failedAttempts,
          downMs: Date.now() - downSince,
          error,
        });
      }
    }
  }

  async close() {
    this.aborted = true;
    this.isConnected = false;
    this.stopStreamWatchdog();
    this.streamController?.abort();

    try {
      const unsubscribes = this.subscriptions.map((sub) => ({
        id: sub.id,
        action: 'unsubscribe',
        subscription: sub.id,
      }));

      {
        const { response, release } = await urbitFetch({
          baseUrl: this.url,
          path: `/~/channel/${this.channelId}`,
          init: {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Cookie: this.cookie,
            },
            body: JSON.stringify(unsubscribes),
          },
          ssrfPolicy: this.ssrfPolicy,
          lookupFn: this.lookupFn,
          fetchImpl: this.fetchImpl,
          timeoutMs: 30_000,
          auditContext: 'tlon-urbit-unsubscribe',
        });
        try {
          void response.body?.cancel();
        } finally {
          await release();
        }
      }

      {
        const { response, release } = await urbitFetch({
          baseUrl: this.url,
          path: `/~/channel/${this.channelId}`,
          init: {
            method: 'DELETE',
            headers: {
              Cookie: this.cookie,
            },
          },
          ssrfPolicy: this.ssrfPolicy,
          lookupFn: this.lookupFn,
          fetchImpl: this.fetchImpl,
          timeoutMs: 30_000,
          auditContext: 'tlon-urbit-channel-close',
        });
        try {
          void response.body?.cancel();
        } finally {
          await release();
        }
      }
    } catch (error) {
      this.logger.error?.(`Error closing channel: ${String(error)}`);
    }

    if (this.streamRelease) {
      const release = this.streamRelease;
      this.streamRelease = null;
      await release();
    }
  }
}
