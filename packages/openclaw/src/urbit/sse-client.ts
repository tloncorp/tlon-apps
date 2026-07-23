import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import type { LookupFn, SsrFPolicy } from 'openclaw/plugin-sdk/ssrf-runtime';

import {
  createUrbitChannel,
  pokeUrbitChannel,
  scryUrbitPath,
  wakeUrbitChannel,
} from './channel-ops.js';
import { getUrbitContext, normalizeUrbitCookie } from './context.js';
import { UrbitHttpError } from './errors.js';
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
  /**
   * The highest event id whose ack PUT was actually ACCEPTED by Eyre (advanced
   * only on a confirmed ok response, via max to tolerate out-of-order async ack
   * completions). This is the floor for event-id regression detection: unlike
   * the optimistic lastAcknowledgedEventId (set before the PUT is sent), a
   * confirmed ack means Eyre has permanently pruned those ids.
   */
  private lastConfirmedAckEventId = -1;
  private readonly ackThreshold = 20;

  /**
   * Always-on per-poke floor ledger (pokeId → lastHeardEventId snapshot at send
   * time). Invariant: on a single Eyre channel generation, a poke's ack event is
   * created AFTER the poke arrives at the ship, so its event id STRICTLY EXCEEDS
   * every event id the client had heard when it SENT the poke. Every poke is
   * tagged unconditionally; every matching ack is judged independently — no
   * arming, no disarming.
   *
   * The recreating poke on a reaped channel is necessarily tracked: all channel
   * PUTs while down go through poke() (subscribe() sends nothing while
   * disconnected, ack actions generate no response events), and its ack is
   * new-generation event 0, delivered first in replay id-order, with 0 <= floor
   * whenever we ever heard an event.
   */
  private pokeFloors = new Map<number, number>();
  private lastPokeId = 0;

  /**
   * Incremented right after the channel is created in connect() — before the
   * wake PUT and the stream GET. A pending post-quit resubscribe watches this:
   * a bump means the new eyre channel was created with the full subscription
   * list (see connect), so the pending sub is already live and sending it again
   * would double-subscribe — even if the wake/GET that follows later fails.
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

  /**
   * Resume/rebuild selector. Set only when the stream GET on an existing
   * channel returns 404/410/500 (the channel was reaped or dead); cleared the
   * instant a fresh channel is created. While false, reconnects resume the same
   * channel.
   */
  private channelReaped = false;

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
    if (this.aborted) return;
    const deps = {
      baseUrl: this.url,
      cookie: this.cookie,
      ship: this.ship,
      channelId: this.channelId,
      ssrfPolicy: this.ssrfPolicy,
      lookupFn: this.lookupFn,
      fetchImpl: this.fetchImpl,
    };
    // Only recreate subscriptions that still have handlers. Entries whose
    // handlers were removed (e.g. replaced after a gall quit) would otherwise
    // double-subscribe and double-deliver after a reconnect.
    const createBody = this.subscriptions.filter((sub) =>
      this.eventHandlers.has(sub.id)
    );
    await createUrbitChannel(deps, {
      body: createBody,
      auditContext: 'tlon-urbit-channel-create',
    });
    // Channel + subs now exist on the ship: clear the reap flag and bump the
    // epoch here (not after openStream) so a pending resubscribeAfterQuit sees
    // its sub was recreated even if the stream GET then fails.
    this.channelReaped = false;
    this.channelEpoch += 1;
    if (this.aborted) return;
    // Best-effort pulse; its failure degrades to resume, not re-mint.
    await wakeUrbitChannel(deps);
    if (this.aborted) return;
    await this.openStream();
    if (this.aborted) {
      this.streamController?.abort();
      await this.releaseStream();
      return;
    }
    this.afterStreamOpen();
  }

  /**
   * Post-openStream bookkeeping: mark the client connected.
   * Guarded on `aborted` so a client closed mid-connect is never marked
   * connected.
   */
  private afterStreamOpen() {
    if (this.aborted) return;
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.lastEventAt = Date.now();
    this.startStreamWatchdog();
  }

  /**
   * Release the current stream resource, clearing the handle first so a
   * concurrent release is a no-op. Reused by processStream/close/connect.
   */
  private async releaseStream() {
    if (this.streamRelease) {
      const release = this.streamRelease;
      this.streamRelease = null;
      await release();
    }
  }

  /**
   * Drop the connected flag and record downtime BEFORE any awaited teardown.
   * The ordering matters: isConnected must be false before the (possibly slow)
   * release await so concurrent callers observe the stream as down immediately.
   * Idempotent.
   */
  private markStreamDown() {
    this.isConnected = false;
    this.streamDownSince ??= Date.now();
  }

  async openStream() {
    // Use AbortController with manual timeout so we only abort during initial connection,
    // not after the SSE stream is established and actively streaming.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);

    this.streamController = controller;

    // Resume cursor: Eyre acks through Last-Event-ID and replays everything
    // after it. Only send it once we've heard at least one event (id 0 is
    // valid; -1 means nothing heard yet).
    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
      Cookie: this.cookie,
    };
    if (this.lastHeardEventId >= 0) {
      headers['Last-Event-ID'] = String(this.lastHeardEventId);
    }

    const { response, release } = await urbitFetch({
      baseUrl: this.url,
      path: `/~/channel/${this.channelId}`,
      init: {
        method: 'GET',
        headers,
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
      const status = response.status;
      this.streamRelease = null;
      await release().catch(() => {});
      throw new UrbitHttpError({ operation: 'Stream connection', status });
    }

    if (!response.body) {
      this.streamRelease = null;
      await release().catch(() => {});
      throw new Error('Stream connection returned no body');
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
      // Clean EOF (the loop completed without throwing): clear the suppression
      // flag here, NOT in finally. A clean end racing our abort must not leave
      // the flag set to swallow the NEXT unrelated stream error. The throwing
      // path skips this line (finally runs first, awaiting attemptReconnect
      // before the error reaches openStream's .catch, where the flag is meant
      // to be consumed).
      this.suppressNextStreamErrorFanout = false;
    } finally {
      // The stream is done (EOF or error): drop the connected flag
      // unconditionally so a client that won't auto-reconnect isn't left
      // marked connected. markStreamDown() setting it again is a no-op.
      this.isConnected = false;
      // Drop the connected flag BEFORE the (possibly slow) release so
      // concurrent callers observe the stream as down immediately. A release
      // rejection is logged, never thrown, so reconnect still runs.
      const willReconnect = !this.aborted && this.autoReconnect;
      if (willReconnect) {
        this.markStreamDown();
      }
      try {
        await this.releaseStream();
      } catch (error) {
        this.logger.error?.(`[SSE] Error releasing stream: ${String(error)}`);
      }
      this.streamController = null;
      if (willReconnect) {
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
        // Strict numeric parse: only a pure digit string is a valid Eyre event
        // id. `12x` must NOT become `12` (parseInt would coerce it).
        const rawId = line.substring(4);
        if (/^\d+$/.test(rawId)) {
          eventId = parseInt(rawId, 10);
        }
      }
      if (line.startsWith('data: ')) {
        data = line.substring(6);
      }
    }

    if (!data) {
      return;
    }

    // Per-poke floor validation (reap-revival detector). On a single Eyre channel
    // generation, the ack event for a poke is created AFTER the poke arrives at
    // the ship, so its event id STRICTLY EXCEEDS every event id the client had
    // heard when it SENT the poke. An ack arriving with eventId <= floor proves
    // the counter restarted → channel recreated → rebuild. Each ack judges only
    // its own poke; a healthy ack resolves only that entry. This block must stay
    // BEFORE the replay-drop so the new-gen event-0 ack is not swallowed as a
    // duplicate.
    if (this.pokeFloors.size > 0 && eventId !== null) {
      let parsedPoke: { id?: number; response?: string } | null = null;
      try {
        parsedPoke = JSON.parse(data);
      } catch {
        parsedPoke = null;
      }
      if (
        parsedPoke &&
        parsedPoke.response === 'poke' &&
        typeof parsedPoke.id === 'number'
      ) {
        const floor = this.pokeFloors.get(parsedPoke.id);
        if (floor !== undefined) {
          if (eventId <= floor) {
            if (!this.aborted && !this.channelReaped) {
              this.logger.error?.(
                `[SSE] Validation poke ${parsedPoke.id} acked at event id ${eventId} <= floor ${floor}; channel recreated — rebuilding`
              );
              const err = new Error(
                `SSE channel recreated (poke ${parsedPoke.id} acked at event ${eventId} <= floor ${floor}) — rebuilding`
              );
              this.channelReaped = true;
              this.suppressNextStreamErrorFanout = true;
              this.markStreamDown();
              this.streamController?.abort();
              for (const { err: h } of this.eventHandlers.values()) {
                try {
                  h?.(err);
                } catch (e) {
                  this.logger.error?.(
                    `[SSE] validation err handler threw: ${String(e)}`
                  );
                }
              }
            }
            return;
          }
          this.pokeFloors.delete(parsedPoke.id);
        }
      }
    }

    // Event-id regression: the floor must be a CONFIRMED ack, not the optimistic
    // cursor. A resume GET replays from Eyre's pre-prune queue (on-get-request
    // binds the channel before acknowledge-events prunes, then builds the replay
    // from that pre-prune binding), so only confirmed-acked — permanently pruned
    // — ids are guaranteed never to be re-sent. An id at or below the confirmed
    // cursor therefore cannot come from our own channel: it means the channel was
    // reaped while we were down and then silently recreated by an outbound poke
    // (a PUT to a missing channel id creates it; its GET returns 200, so the
    // resume status check cannot see this). The revived channel has no
    // subscriptions — force a rebuild.
    if (
      eventId !== null &&
      this.lastConfirmedAckEventId >= 0 &&
      eventId <= this.lastConfirmedAckEventId
    ) {
      if (this.aborted || this.channelReaped) {
        return; // teardown already in flight; don't double-fire
      }
      this.logger.error?.(
        `[SSE] Event id regression: heard id ${eventId} <= last confirmed acked ${this.lastConfirmedAckEventId}; channel was recreated out from under us — rebuilding`
      );
      const regressionError = new Error(
        `SSE event id regression (heard ${eventId}, confirmed acked ${this.lastConfirmedAckEventId}); channel recreated — rebuilding`
      );
      // Tear down BEFORE notifying handlers so a throwing handler can't strand
      // the client on the dead channel; isolate each handler so one throw can't
      // stop the others.
      this.channelReaped = true;
      this.suppressNextStreamErrorFanout = true;
      this.markStreamDown();
      this.streamController?.abort();
      for (const { err } of this.eventHandlers.values()) {
        try {
          err?.(regressionError);
        } catch (e) {
          this.logger.error?.(
            `[SSE] regression err handler threw: ${String(e)}`
          );
        }
      }
      return;
    }

    // Replay drop: Eyre redelivers every unacked event on resume, so a frame
    // whose id we've already heard is a duplicate. Refresh liveness (the frame
    // proves the socket is alive) but skip handler dispatch AND ack
    // bookkeeping. New ids keep the advance + threshold-ack below.
    if (eventId !== null && eventId <= this.lastHeardEventId) {
      this.lastEventAt = Date.now();
      return;
    }

    // Track event ID and send ack if needed
    if (eventId !== null) {
      if (eventId > this.lastHeardEventId) {
        this.lastHeardEventId = eventId;
        if (eventId - this.lastAcknowledgedEventId > this.ackThreshold) {
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

      // Successful poke acknowledgements are routine stream traffic. Keep failures
      // observable without emitting an info log for every successful poke.
      if (parsed.response === 'poke') {
        if (parsed.err) {
          this.logger.error?.(
            `[SSE] Poke NACK id=${parsed.id}: ${JSON.stringify(parsed.err)}`
          );
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
    // After close() the channel is unsubscribed/DELETEd on the ship. A stale
    // poke from an old monitor (e.g. across a config-reload restart) would
    // otherwise recreate that channel as a side effect, so reject once closed.
    if (this.aborted) {
      throw new Error('SSE client closed; poke rejected');
    }
    // Monotonic id: max(Date.now(), last+1) prevents same-ms collisions and
    // clock-jump reuse.
    const pokeId = Math.max(Date.now(), this.lastPokeId + 1);
    this.lastPokeId = pokeId;
    if (this.pokeFloors.size >= 4096) {
      // A full ledger means thousands of poke acks never came back — this
      // channel generation is unrecoverable. Escalate to a rebuild (which
      // clears the ledger) instead of silently degrading to untracked pokes,
      // which could leave a revived, subscription-less channel undetectable.
      if (!this.aborted && !this.channelReaped) {
        this.logger.error?.(
          `[SSE] Poke-floor ledger full (${this.pokeFloors.size}); forcing channel rebuild`
        );
        this.channelReaped = true;
        this.markStreamDown();
        this.streamController?.abort();
      }
    } else {
      this.pokeFloors.set(pokeId, this.lastHeardEventId);
    }
    // A rejection is delivery-ambiguous (pokeUrbitChannel can get an OK response
    // then reject from release() in its finally). A stale entry blocks nothing:
    // it resolves via ack-match, rebuild clear, or never (bounded by the cap).
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
      {
        ...params,
        pokeId,
        auditContext: 'tlon-urbit-poke',
      }
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
    const ackChannelId = this.channelId;
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
      // Advance the confirmed cursor only when the ack resolved for the CURRENT
      // channel. A rebuild (which re-mints channelId and resets the cursor)
      // invalidates an in-flight ack for the old channel, and its stale
      // old-channel id must not repopulate the confirmed floor. A resume keeps
      // the same channelId, so its acks remain valid — this only skips acks
      // whose channel was rebuilt out from under them. Use max to tolerate
      // out-of-order async ack completions (a later id confirmed before an
      // earlier one must not regress the floor).
      if (this.channelId === ackChannelId) {
        this.lastConfirmedAckEventId = Math.max(
          this.lastConfirmedAckEventId,
          eventId
        );
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
      if (this.aborted) return;
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
    if (this.aborted) return;

    try {
      if (this.onReconnect) {
        await this.onReconnect(this);
      }
      if (this.aborted) return;

      // Capture the mode AFTER the onReconnect await: a cap-escalation (or any
      // channelReaped set) landing during that await has no live stream
      // controller to abort, so this read is its only path into the rebuild
      // branch. Resume is the default; rebuild only when the channel itself is
      // gone. No awaits between this read and the branch below.
      const rebuild = this.channelReaped;

      // connect()/afterStreamOpen() reset the attempt counter on success;
      // capture it first for the recovery event.
      const attempt = this.reconnectAttempts;

      if (rebuild) {
        this.logger.log?.(
          `[SSE] Rebuilding channel (reaped; last event ${this.lastHeardEventId})...`
        );
        // Mint a fresh channel and reset both cursors — per-channel event ids
        // restart at 0, so a stale Last-Event-ID would drop the first N events.
        this.channelId = `${Math.floor(Date.now() / 1000)}-${randomUUID().slice(0, 8)}`;
        this.channelUrl = new URL(
          `/~/channel/${this.channelId}`,
          this.url
        ).toString();
        this.lastHeardEventId = -1;
        this.lastAcknowledgedEventId = -1;
        this.lastConfirmedAckEventId = -1;
        this.pokeFloors.clear();
        await this.connect();
      } else {
        this.logger.log?.(
          `[SSE] Resuming channel ${this.channelId} from event ${this.lastHeardEventId}...`
        );
        // Keep channelId/channelUrl and channelEpoch unchanged so a pending
        // resubscribeAfterQuit can still send its own replacement PUT.
        await this.openStream();
        this.afterStreamOpen();
      }

      // A close() that raced the connect must not emit a false reconnect-success.
      if (this.aborted) return;
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
      // An abort-induced fetch rejection must not emit reconnect_failed after
      // close().
      if (this.aborted) return;
      this.logger.error?.(`[SSE] Reconnection failed: ${String(error)}`);
      // The reap signal is specifically the stream GET on an existing channel
      // returning 404/410/500 (channel reaped or dead) — NOT create/wake
      // failures (those carry operations 'Channel creation'/'Channel
      // activation'). A 500 on the stream GET is a dead channel: rebuilding is
      // required, matching @tloncorp/api's seamlessReset() on SSE status 500.
      if (
        error instanceof UrbitHttpError &&
        error.operation === 'Stream connection' &&
        (error.status === 404 || error.status === 410 || error.status === 500)
      ) {
        this.channelReaped = true;
      }
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
   * into the normal auto-reconnect path. That path RESUMES the existing
   * channel by default, rebuilding a fresh channel only when the resume GET
   * returns 404/410/500 (reaped/dead).
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
      // Drop the connected flag before the abort so the abort→finally gap
      // observes the stream as down. Idempotent with the processStream finally.
      this.markStreamDown();
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
