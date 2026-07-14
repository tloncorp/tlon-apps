/**
 * Minimal Eyre (Urbit HTTP API) client: +code login, channel pokes and
 * subscriptions, SSE event stream with acking and reconnect, scries.
 *
 * Intentionally small and dependency-free. The heavier lifting (message
 * sends, history reads) goes through the tlon CLI instead — see cli.ts.
 */
import { randomUUID } from 'node:crypto';

export type EyreLogger = (message: string) => void;

type Subscription = {
  actionId: number;
  app: string;
  path: string;
  onEvent: (data: unknown) => void;
};

export class EyreClient {
  private cookie: string | null = null;
  private channelId: string;
  private nextActionId = 1;
  private lastEventId = 0;
  private unackedEvents = 0;
  private subscriptions: Subscription[] = [];
  private closed = false;
  private streamAbort: AbortController | null = null;
  private readonly debug = process.env.TLON_DEBUG === '1';

  constructor(
    private readonly url: string,
    private readonly ship: string,
    private readonly code: string,
    private readonly log: EyreLogger = () => {}
  ) {
    this.channelId = `claude-tlon-${Date.now()}-${randomUUID().slice(0, 8)}`;
  }

  get shipName(): string {
    return this.ship;
  }

  async login(): Promise<void> {
    const response = await fetch(`${this.url}/~/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `password=${encodeURIComponent(this.code)}`,
      redirect: 'manual',
    });
    const setCookie = response.headers.get('set-cookie');
    if (!setCookie || !/urbauth/.test(setCookie)) {
      throw new Error(
        `Login to ${this.url} failed (status ${response.status})`
      );
    }
    this.cookie = setCookie.split(';')[0];
    this.log(`[eyre] Authenticated to ${this.url} as ${this.ship}`);
  }

  private async putActions(actions: Record<string, unknown>[]): Promise<void> {
    if (!this.cookie) {
      await this.login();
    }
    const put = () =>
      fetch(`${this.url}/~/channel/${this.channelId}`, {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          cookie: this.cookie!,
        },
        body: JSON.stringify(actions),
      });
    let response = await put();
    if (response.status === 401 || response.status === 403) {
      await this.login();
      response = await put();
    }
    if (!response.ok) {
      throw new Error(
        `Channel PUT failed: ${response.status} ${await response
          .text()
          .catch(() => '')}`
      );
    }
  }

  async poke(app: string, mark: string, json: unknown): Promise<void> {
    const id = this.nextActionId++;
    await this.putActions([
      {
        id,
        action: 'poke',
        ship: this.ship.replace(/^~/, ''),
        app,
        mark,
        json,
      },
    ]);
  }

  async subscribe(
    app: string,
    path: string,
    onEvent: (data: unknown) => void
  ): Promise<void> {
    const id = this.nextActionId++;
    this.subscriptions.push({ actionId: id, app, path, onEvent });
    await this.putActions([
      {
        id,
        action: 'subscribe',
        ship: this.ship.replace(/^~/, ''),
        app,
        path,
      },
    ]);
    this.log(`[eyre] Subscribed to ${app}${path}`);
  }

  async scry<T = unknown>(app: string, path: string): Promise<T> {
    if (!this.cookie) {
      await this.login();
    }
    const response = await fetch(`${this.url}/~/scry/${app}${path}`, {
      headers: { cookie: this.cookie! },
    });
    if (!response.ok) {
      throw new Error(`Scry ${app}${path} failed: ${response.status}`);
    }
    return (await response.json()) as T;
  }

  /**
   * Open the SSE stream and dispatch events to subscriptions until closed.
   * Reconnects with backoff; on channel loss, re-creates the channel and
   * replays all subscriptions.
   */
  async runEventStream(): Promise<void> {
    let backoffMs = 1000;
    while (!this.closed) {
      try {
        await this.streamOnce();
        backoffMs = 1000;
      } catch (err) {
        if (this.closed) {
          return;
        }
        this.log(`[eyre] Stream error: ${String(err)}`);
      }
      if (this.closed) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      backoffMs = Math.min(backoffMs * 2, 30_000);
      // Assume the channel died; start fresh and resubscribe everything.
      await this.reset().catch((err) =>
        this.log(`[eyre] Reset failed: ${String(err)}`)
      );
    }
  }

  private async reset(): Promise<void> {
    this.channelId = `claude-tlon-${Date.now()}-${randomUUID().slice(0, 8)}`;
    this.lastEventId = 0;
    this.unackedEvents = 0;
    const existing = this.subscriptions;
    this.subscriptions = [];
    for (const sub of existing) {
      await this.subscribe(sub.app, sub.path, sub.onEvent);
    }
  }

  private async streamOnce(): Promise<void> {
    if (!this.cookie) {
      await this.login();
    }
    this.streamAbort = new AbortController();
    const response = await fetch(`${this.url}/~/channel/${this.channelId}`, {
      headers: {
        accept: 'text/event-stream',
        cookie: this.cookie!,
        'last-event-id': String(this.lastEventId),
      },
      signal: this.streamAbort.signal,
    });
    if (!response.ok || !response.body) {
      throw new Error(`SSE connect failed: ${response.status}`);
    }
    this.log('[eyre] Event stream connected');

    const decoder = new TextDecoder();
    let buffer = '';
    let eventId: number | null = null;
    let dataLines: string[] = [];

    const flush = async () => {
      if (dataLines.length === 0) {
        return;
      }
      const payload = dataLines.join('\n');
      dataLines = [];
      if (eventId !== null) {
        this.lastEventId = eventId;
        eventId = null;
        this.unackedEvents++;
        if (this.unackedEvents >= 30) {
          this.unackedEvents = 0;
          this.putActions([
            { id: this.nextActionId++, action: 'ack', 'event-id': this.lastEventId },
          ]).catch((err) => this.log(`[eyre] Ack failed: ${String(err)}`));
        }
      }
      try {
        this.dispatch(JSON.parse(payload));
      } catch (err) {
        this.log(`[eyre] Bad event payload: ${String(err)}`);
      }
    };

    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk as Uint8Array, { stream: true });
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIndex).replace(/\r$/, '');
        buffer = buffer.slice(newlineIndex + 1);
        if (line === '') {
          await flush();
        } else if (line.startsWith('id:')) {
          eventId = Number(line.slice(3).trim());
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trimStart());
        }
      }
    }
    throw new Error('SSE stream ended');
  }

  private dispatch(event: unknown): void {
    if (!event || typeof event !== 'object') {
      return;
    }
    const evt = event as {
      id?: number;
      response?: string;
      json?: unknown;
      err?: unknown;
      ok?: unknown;
    };
    if (evt.response === 'diff') {
      const sub = this.subscriptions.find((s) => s.actionId === evt.id);
      if (sub) {
        try {
          sub.onEvent(evt.json);
        } catch (err) {
          this.log(`[eyre] Event handler error: ${String(err)}`);
        }
      } else if (this.debug) {
        this.log(`[eyre] Diff for unknown subscription id ${evt.id}`);
      }
      return;
    }
    if (evt.response === 'quit') {
      const sub = this.subscriptions.find((s) => s.actionId === evt.id);
      if (sub) {
        this.log(`[eyre] Subscription quit: ${sub.app}${sub.path}; resubscribing`);
        this.subscribe(sub.app, sub.path, sub.onEvent).catch((err) =>
          this.log(`[eyre] Resubscribe failed: ${String(err)}`)
        );
        this.subscriptions = this.subscriptions.filter((s) => s !== sub);
      }
      return;
    }
    if (evt.response === 'poke' && evt.err) {
      this.log(`[eyre] Poke nack: ${JSON.stringify(evt.err)}`);
      return;
    }
    if (evt.response === 'subscribe') {
      const sub = this.subscriptions.find((s) => s.actionId === evt.id);
      const label = sub ? `${sub.app}${sub.path}` : `action ${evt.id}`;
      if (evt.err) {
        this.log(
          `[eyre] Subscribe FAILED for ${label}: ${JSON.stringify(evt.err)}`
        );
      } else {
        this.log(`[eyre] Subscribe acked for ${label}`);
      }
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    this.streamAbort?.abort();
    if (this.cookie) {
      await fetch(`${this.url}/~/channel/${this.channelId}`, {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          cookie: this.cookie,
        },
        body: JSON.stringify([
          { id: this.nextActionId++, action: 'delete' },
        ]),
      }).catch(() => {});
    }
  }
}
