import { isBrowser } from 'browser-or-node';
//@ts-expect-error no typedefs
import { fetch as streamingFetch } from 'react-native-fetch-api';
//@ts-expect-error no typedefs
import { polyfill as polyfillEncoding } from 'react-native-polyfill-globals/src/encoding';
//@ts-expect-error no typedefs
import { polyfill as polyfillReadableStream } from 'react-native-polyfill-globals/src/readable-stream';

import { UrbitHttpApiEvent, UrbitHttpApiEventType } from './events';
import { EventSourceMessage, fetchEventSource } from './fetch-event-source';
import {
  Ack,
  AuthError,
  AuthenticationInterface,
  FatalError,
  Message,
  PokeHandlers,
  PokeInterface,
  ReapError,
  SSEOptions,
  Scry,
  SubscriptionRequestInterface,
  Thread,
  headers,
} from './types';
import EventEmitter, { hexString } from './utils';

polyfillReadableStream();
polyfillEncoding();

let abortController = new AbortController();

/**
 * A class for interacting with an urbit ship, given its URL and code
 */
export class Urbit {
  /**
   * Event emitter for debugging, see events.ts for full list of events
   */
  private emitter = new EventEmitter();

  /**
   * UID will be used for the channel: The current unix time plus a random hex string
   */
  private uid: string = `${Math.floor(Date.now() / 1000)}-${hexString(6)}`;

  /**
   * lastEventId is an auto-updated index of which events have been *sent* over this channel.
   * lastHeardEventId is the latest event we have heard back about.
   * lastAcknowledgedEventId is the latest event we have sent an ack for.
   */
  private lastEventId: number = 0;
  private lastHeardEventId: number = -1;
  private lastAcknowledgedEventId: number = -1;

  /**
   * SSE Client is null for now; we don't want to start polling until it the channel exists
   */
  private sseClientInitialized: boolean = false;

  /**
   * Cookie gets set when we log in.
   */
  cookie?: string;

  /**
   * A registry of requestId to successFunc/failureFunc
   *
   * These functions are registered during a +poke and are executed
   * in the onServerEvent()/onServerError() callbacks. Only one of
   * the functions will be called, and the outstanding poke will be
   * removed after calling the success or failure function.
   */

  private outstandingPokes: Map<number, PokeHandlers> = new Map();

  /**
   * A registry of requestId to subscription functions.
   *
   * These functions are registered during a +subscribe and are
   * executed in the onServerEvent()/onServerError() callbacks. The
   * event function will be called whenever a new piece of data on this
   * subscription is available, which may be 0, 1, or many times. The
   * disconnect function may be called exactly once.
   */
  private outstandingSubscriptions: Map<number, SubscriptionRequestInterface> =
    new Map();

  /**
   * Identity of the ship we're connected to
   */
  ship?: string | null;

  /**
   * Our identity, with which we are authenticated into the ship
   */
  our?: string | null;

  /**
   * If verbose, logs output eagerly.
   */
  verbose?: boolean;

  /**
   * number of consecutive errors in connecting to the eventsource
   */
  private errorCount = 0;

  /** This is basic interpolation to get the channel URL of an instantiated Urbit connection. */
  private get channelUrl(): string {
    return `${this.url}/~/channel/${this.uid}`;
  }

  private get fetchOptions(): any {
    const headers: headers = {
      'Content-Type': 'application/json',
    };

    return {
      credentials: isBrowser ? 'include' : undefined,
      accept: '*',
      headers,
      signal: abortController.signal,
      reactNative: { textStreaming: true },
    };
  }

  /**
   * Constructs a new Urbit connection.
   *
   * @param url  The URL (with protocol and port) of the ship to be accessed. If
   * the airlock is running in a webpage served by the ship, this should just
   * be the empty string.
   * @param code The access code for the ship at that address
   */
  constructor(
    public url: string,
    public code?: string,
    public desk?: string
  ) {
    if (isBrowser) {
      window.addEventListener('beforeunload', this.delete);
    }
    return this;
  }

  /**
   * All-in-one hook-me-up.
   *
   * Given a ship, url, and code, this returns an airlock connection
   * that is ready to go. It `|hi`s itself to create the channel,
   * then opens the channel via EventSource.
   *
   */
  //TODO  rename this to connect() and only do constructor & event source setup.
  //      that way it can be used with the assumption that you're already
  //      authenticated.
  static async authenticate({
    ship,
    url,
    code,
    verbose = false,
  }: AuthenticationInterface) {
    const airlock = new Urbit(
      url.startsWith('http') ? url : `http://${url}`,
      code
    );
    airlock.verbose = verbose;
    airlock.ship = ship;
    await airlock.connect();
    await airlock.poke({
      app: 'hood',
      mark: 'helm-hi',
      json: 'opening airlock',
    });
    await airlock.eventSource();
    return airlock;
  }

  private emit<T extends UrbitHttpApiEventType>(
    event: T,
    data: UrbitHttpApiEvent[T]
  ) {
    this.emitter.emit(event, data);
  }

  on<T extends UrbitHttpApiEventType>(
    event: T,
    callback: (data: UrbitHttpApiEvent[T]) => void
  ): void {
    this.emitter.on(event, callback);

    this.verbose && console.log(event, 'listening active');
    if (event === 'init') {
      this.emitter.emit(event, {
        uid: this.uid,
        subscriptions: [...this.outstandingSubscriptions.entries()].map(
          ([k, v]) => ({ id: k, app: v.app, path: v.path })
        ),
      });
    }
  }

  /**
   * Gets the name of the ship accessible at this.url and stores it to this.ship
   *
   */
  async getShipName(): Promise<void> {
    if (this.ship) {
      return Promise.resolve();
    }

    const nameResp = await streamingFetch(`${this.url}/~/host`, {
      method: 'get',
      credentials: 'include',
    });
    const name = await nameResp.text();
    this.ship = name.substring(1);
  }

  /**
   * Gets the name of the ship accessible at this.url and stores it to this.ship
   *
   */
  async getOurName(): Promise<void> {
    if (this.our) {
      return Promise.resolve();
    }

    const nameResp = await streamingFetch(`${this.url}/~/name`, {
      method: 'get',
      credentials: 'include',
    });
    const name = await nameResp.text();
    this.our = name.substring(1);
  }

  /**
   * Connects to the Urbit ship. Nothing can be done until this is called.
   * That's why we roll it into this.authenticate
   * TODO  as of urbit/urbit#6561, this is no longer true, and we are able
   *       to interact with the ship using a guest identity.
   */
  //TODO  rename to authenticate() and call connect() at the end
  async connect(): Promise<void> {
    if (this.verbose) {
      console.log(
        `password=${this.code} `,
        isBrowser
          ? 'Connecting in browser context at ' + `${this.url}/~/login`
          : 'Connecting from node context'
      );
    }
    return streamingFetch(`${this.url}/~/login`, {
      method: 'post',
      body: `password=${this.code}`,
      credentials: 'include',
    }).then(async (response: Response) => {
      if (this.verbose) {
        console.log('Received authentication response', response);
      }
      if (response.status >= 200 && response.status < 300) {
        throw new Error('Login failed with status ' + response.status);
      }
      const cookie = response.headers.get('set-cookie');
      if (!this.ship && cookie) {
        this.ship = new RegExp(/urbauth-~([\w-]+)/).exec(cookie)?.[1];
      }
      if (!isBrowser) {
        this.cookie = cookie || undefined;
      }
      this.getShipName();
      this.getOurName();
    });
  }

  /**
   * Initializes the SSE pipe for the appropriate channel.
   */
  async eventSource(): Promise<void> {
    if (this.sseClientInitialized) {
      return Promise.resolve();
    }
    if (this.lastEventId === 0) {
      this.emit('status-update', { status: 'opening' });
      // Can't receive events until the channel is open,
      // so poke and open then
      await this.poke({
        app: 'hood',
        mark: 'helm-hi',
        json: 'Opening API channel',
      });
      return;
    }
    this.sseClientInitialized = true;
    return new Promise((resolve, reject) => {
      const sseOptions: SSEOptions = {
        headers: {},
      };
      if (isBrowser) {
        sseOptions.withCredentials = true;
      }
      fetchEventSource(this.channelUrl, {
        ...this.fetchOptions,
        openWhenHidden: true,
        responseTimeout: 25000,
        fetch: streamingFetch,
        onopen: async (response, isReconnect) => {
          if (this.verbose) {
            console.log('Opened eventsource', response);
          }
          if (response.ok) {
            this.errorCount = 0;
            this.emit('status-update', {
              status: isReconnect ? 'reconnected' : 'active',
            });
            resolve();
            return; // everything's good
          } else {
            const err = new Error('failed to open eventsource');
            reject(err);
          }
        },
        onmessage: (event: EventSourceMessage) => {
          if (this.verbose) {
            console.log('Received SSE: ', event);
          }
          if (!event.id) return;
          const eventId = parseInt(event.id, 10);
          this.emit('fact', {
            id: eventId,
            data: event.data,
            time: Date.now(),
          });
          if (eventId <= this.lastHeardEventId) {
            if (this.verbose) {
              console.log('dropping old or out-of-order event', {
                eventId,
                lastHeard: this.lastHeardEventId,
              });
            }
            return;
          }
          this.lastHeardEventId = eventId;
          this.emit('id-update', { lastHeard: this.lastHeardEventId });
          if (eventId - this.lastAcknowledgedEventId > 20) {
            this.ack(eventId);
          }

          if (event.data && JSON.parse(event.data)) {
            const data: any = JSON.parse(event.data);

            if (
              data.response === 'poke' &&
              this.outstandingPokes.has(data.id)
            ) {
              const funcs = this.outstandingPokes.get(data.id);
              if ('ok' in data && funcs) {
                funcs.onSuccess?.();
              } else if ('err' in data && funcs) {
                console.error(data.err);
                funcs.onError?.(data.err);
              } else {
                console.error('Invalid poke response', data);
              }
              this.outstandingPokes.delete(data.id);
            } else if (
              data.response === 'subscribe' &&
              this.outstandingSubscriptions.has(data.id)
            ) {
              const funcs = this.outstandingSubscriptions.get(data.id);
              if ('err' in data && funcs) {
                console.error(data.err);
                funcs.err?.(data.err, data.id);
                this.outstandingSubscriptions.delete(data.id);
              }
            } else if (
              data.response === 'diff' &&
              this.outstandingSubscriptions.has(data.id)
            ) {
              const funcs = this.outstandingSubscriptions.get(data.id);
              try {
                funcs?.event?.(data.json, data.mark ?? 'json', data.id);
              } catch (e) {
                console.error('Failed to call subscription event callback', e);
              }
            } else if (
              data.response === 'quit' &&
              this.outstandingSubscriptions.has(data.id)
            ) {
              const sub = this.outstandingSubscriptions.get(data.id);
              sub?.quit?.(data);
              this.outstandingSubscriptions.delete(data.id);
              this.emit('subscription', {
                id: data.id,
                status: 'close',
              });
              if (sub?.resubOnQuit) {
                this.subscribe(sub);
              }
            } else if (this.verbose) {
              console.log([...this.outstandingSubscriptions.keys()]);
              console.log('Unrecognized response', data);
            }
          }
        },
        onerror: (error) => {
          this.errorCount++;
          this.emit('error', {
            time: Date.now(),
            msg: JSON.stringify(error),
            error,
          });
          if (error instanceof ReapError) {
            this.emit('channel-reaped', { time: Date.now() });
            this.seamlessReset();
            return;
          }
          if (!(error instanceof FatalError)) {
            this.emit('status-update', { status: 'reconnecting' });
            return Math.min(5000, Math.pow(2, this.errorCount - 1) * 750);
          }
          this.emit('status-update', { status: 'errored' });
          throw error;
        },
        onclose: () => {
          console.log('e');
          throw new Error('Ship unexpectedly closed the connection');
        },
      });
    });
  }

  /**
   * Reset airlock, abandoning current subscriptions and wiping state
   *
   */
  reset() {
    if (this.verbose) {
      console.log('resetting');
    }
    this.delete();
    this.uid = `${Math.floor(Date.now() / 1000)}-${hexString(6)}`;
    this.emit('reset', { uid: this.uid });
    this.lastEventId = 0;
    this.lastHeardEventId = -1;
    this.lastAcknowledgedEventId = -1;
    this.outstandingSubscriptions = new Map();
    this.outstandingPokes = new Map();
    this.sseClientInitialized = false;
  }

  private seamlessReset() {
    // called if a channel was reaped by %eyre before we reconnected
    // so we have to make a new channel.
    this.uid = `${Math.floor(Date.now() / 1000)}-${hexString(6)}`;
    this.emit('seamless-reset', { uid: this.uid });
    this.emit('status-update', { status: 'initial' });
    this.sseClientInitialized = false;
    this.lastEventId = 0;
    this.lastHeardEventId = -1;
    this.lastAcknowledgedEventId = -1;
    const oldSubs = [...this.outstandingSubscriptions.entries()];
    this.outstandingSubscriptions = new Map();
    oldSubs.forEach(([id, sub]) => {
      sub.quit?.({
        id,
        response: 'quit',
      });
      this.emit('subscription', {
        id,
        status: 'close',
      });

      if (sub.resubOnQuit) {
        this.subscribe(sub);
      }
    });

    this.outstandingPokes.forEach((poke, id) => {
      poke.onError?.('Channel was reaped');
    });
    this.outstandingPokes = new Map();
  }

  /**
   * Autoincrements the next event ID for the appropriate channel.
   */
  private getEventId(): number {
    this.lastEventId += 1;
    this.emit('id-update', { current: this.lastEventId });
    return this.lastEventId;
  }

  /**
   * Acknowledges an event.
   *
   * @param eventId The event to acknowledge.
   */
  private async ack(eventId: number): Promise<number | void> {
    this.lastAcknowledgedEventId = eventId;
    this.emit('id-update', { lastAcknowledged: eventId });
    const message: Ack = {
      action: 'ack',
      'event-id': eventId,
    };
    await this.sendJSONtoChannel(message);
    return eventId;
  }

  private async sendJSONtoChannel(...json: (Message | Ack)[]): Promise<void> {
    const response = await streamingFetch(this.channelUrl, {
      ...this.fetchOptions,
      method: 'PUT',
      body: JSON.stringify(json),
    });
    if (!response.ok) {
      throw new Error('Failed to PUT channel');
    }
    if (!this.sseClientInitialized) {
      if (this.verbose) {
        console.log('initializing event source');
      }
      await Promise.all([this.getOurName(), this.getShipName()]);

      if (this.our !== this.ship) {
        console.log('our name does not match ship name');
        throw new AuthError('invalid session');
      }

      await this.eventSource();
    }
  }

  /**
   * Creates a subscription, waits for a fact and then unsubscribes
   *
   * @param app Name of gall agent to subscribe to
   * @param path Path to subscribe to
   * @param timeout Optional timeout before ending subscription
   *
   * @returns The first fact on the subcription
   */
  async subscribeOnce<T = any>(app: string, path: string, timeout?: number) {
    return new Promise<T>((resolve, reject) => {
      let done = false;
      const quit = () => {
        if (!done) {
          reject('quit');
        }
      };
      const event = (e: T, mark: string, id: number) => {
        if (!done) {
          resolve(e);
          this.unsubscribe(id);
        }
      };
      const request = {
        app,
        path,
        resubOnQuit: false,
        event,
        err: reject,
        quit,
      };

      this.subscribe(request).then((subId) => {
        if (timeout) {
          setTimeout(() => {
            if (!done) {
              done = true;
              reject('timeout');
              this.unsubscribe(subId);
            }
          }, timeout);
        }
      });
    });
  }

  /**
   * Pokes a ship with data.
   *
   * @param app The app to poke
   * @param mark The mark of the data being sent
   * @param json The data to send
   */
  async poke<T>(params: PokeInterface<T>): Promise<number> {
    const { app, mark, json, ship, onSuccess, onError } = {
      onSuccess: () => {},
      onError: () => {},
      ship: this.ship,
      ...params,
    };

    if (this.lastEventId === 0) {
      this.emit('status-update', { status: 'opening' });
    }

    const message: Message = {
      id: this.getEventId(),
      action: 'poke',
      ship,
      app,
      mark,
      json,
    };
    this.outstandingPokes.set(message.id, {
      onSuccess: () => {
        onSuccess();
      },
      onError: (err) => {
        onError(err);
      },
    });
    await this.sendJSONtoChannel(message);
    return message.id;
  }

  /**
   * Subscribes to a path on an app on a ship.
   *
   *
   * @param app The app to subsribe to
   * @param path The path to which to subscribe
   * @param handlers Handlers to deal with various events of the subscription
   */
  async subscribe(params: SubscriptionRequestInterface): Promise<number> {
    const { app, path, ship, resubOnQuit, err, event, quit } = {
      err: () => {},
      event: () => {},
      quit: () => {},
      ship: this.ship,
      resubOnQuit: true,
      ...params,
    };

    if (this.lastEventId === 0) {
      this.emit('status-update', { status: 'opening' });
    }

    const message: Message = {
      id: this.getEventId(),
      action: 'subscribe',
      ship,
      app,
      path,
    };

    this.outstandingSubscriptions.set(message.id, {
      app,
      path,
      resubOnQuit,
      err,
      event,
      quit,
    });

    this.emit('subscription', {
      id: message.id,
      app,
      path,
      status: 'open',
    });

    await this.sendJSONtoChannel(message);

    return message.id;
  }

  /**
   * Unsubscribes to a given subscription.
   *
   * @param subscription
   */
  async unsubscribe(subscription: number) {
    return this.sendJSONtoChannel({
      id: this.getEventId(),
      action: 'unsubscribe',
      subscription,
    }).then(() => {
      this.emit('subscription', {
        id: subscription,
        status: 'close',
      });
      this.outstandingSubscriptions.delete(subscription);
    });
  }

  abort() {
    abortController.abort();
    abortController = new AbortController();
  }

  /**
   * Deletes the connection to a channel.
   */
  async delete() {
    this.abort();
    const body = JSON.stringify([
      {
        id: this.getEventId(),
        action: 'delete',
      },
    ]);
    if (isBrowser) {
      navigator.sendBeacon(this.channelUrl, body);
    } else {
      const response = await streamingFetch(this.channelUrl, {
        ...this.fetchOptions,
        method: 'POST',
        body: body,
      });
      if (!response.ok) {
        throw new Error('Failed to DELETE channel in node context');
      }
    }
  }

  /**
   * Scry into an gall agent at a path
   *
   * @typeParam T - Type of the scry result
   *
   * @remarks
   *
   * Equivalent to
   * ```hoon
   * .^(T %gx /(scot %p our)/[app]/(scot %da now)/[path]/json)
   * ```
   * The returned cage must have a conversion to JSON for the scry to succeed
   *
   * @param params The scry request
   * @returns The scry result
   */
  async scry<T = any>(params: Scry): Promise<T> {
    const { app, path } = params;
    const response = await streamingFetch(
      `${this.url}/~/scry/${app}${path}.json`,
      this.fetchOptions
    );

    if (!response.ok) {
      return Promise.reject(response);
    }

    return await response.json();
  }

  /**
   * Run a thread
   *
   *
   * @param inputMark   The mark of the data being sent
   * @param outputMark  The mark of the data being returned
   * @param threadName  The thread to run
   * @param body        The data to send to the thread
   * @returns  The return value of the thread
   */
  async thread<R, T = any>(params: Thread<T>): Promise<R> {
    const {
      inputMark,
      outputMark,
      threadName,
      body,
      desk = this.desk,
    } = params;
    if (!desk) {
      throw new Error('Must supply desk to run thread from');
    }
    const res = await streamingFetch(
      `${this.url}/spider/${desk}/${inputMark}/${threadName}/${outputMark}.json`,
      {
        ...this.fetchOptions,
        method: 'POST',
        body: JSON.stringify(body),
      }
    );

    return res.json();
  }

  /**
   * Utility function to connect to a ship that has its *.arvo.network domain configured.
   *
   * @param name Name of the ship e.g. zod
   * @param code Code to log in
   */
  static async onArvoNetwork(ship: string, code: string): Promise<Urbit> {
    const url = `https://${ship}.arvo.network`;
    return await Urbit.authenticate({ ship, url, code });
  }
}

export default Urbit;
