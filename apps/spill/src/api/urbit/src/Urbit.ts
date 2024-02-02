import EventSource from 'react-native-sse';
import { UrbitHttpApiEvent, UrbitHttpApiEventType } from './events';

const isNode = true;
const isBrowser = false;

import {
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
  Headers,
} from './types';
import EventEmitter, { hexString } from './utils';

/**
 * A class for interacting with an urbit ship, given its URL and code
 */
export class Urbit {
  /**
   * Event emitter for debugging, see events.ts for full list of events
   */
  private emitter = new EventEmitter();

  private eventSourcePromise: Promise<void> | null = null;

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
  cookie?: string | undefined;

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
   * Our abort controller, used to close the connection
   */
  private abort = new AbortController();

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

  onError?: (error: any) => void = null;

  onRetry?: () => void = null;

  onOpen?: () => void = null;

  onReconnect?: () => void = null;

  /** This is basic interpolation to get the channel URL of an instantiated Urbit connection. */
  private get channelUrl(): string {
    return `${this.url}/~/channel/${this.uid}`;
  }

  private get fetchOptions(): any {
    const headers: Headers = {
      'Content-Type': 'application/json',
    };
    if (!isBrowser) {
      headers.Cookie = this.cookie;
    }
    return {
      accept: '*',
      headers,
      credentials: 'omit',
      signal: this.abort.signal,
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
  constructor(public url: string, public code?: string, public desk?: string) {
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
    const airlock = new Urbit(url, code);
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
    if (this.verbose) {
      this.emitter.emit(event, data);
    }
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

    const nameResp = await fetch(`${this.url}/~/host`, {
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

    const nameResp = await fetch(`${this.url}/~/name`, {
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

    return fetch(`${this.url}/~/login`, {
      method: 'post',
      body: `password=${this.code}`,
      credentials: 'include',
    }).then(async (response) => {
      if (this.verbose) {
        console.log('Received authentication response', response);
      }
      // if (response.status >= 200 && response.status < 300) {
      //   throw new Error('Login failed with status ' + response.status);
      // }

      const cookie = response.headers.get('set-cookie');
      if (!this.ship && cookie) {
        this.ship = new RegExp(/urbauth-~([\w-]+)/).exec(cookie)[1];
      }
      if (!isBrowser) {
        this.cookie = cookie.split(';')[0];
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
    if (this.eventSourcePromise) {
      return this.eventSourcePromise;
    }
    if (this.lastEventId === 0) {
      this.emit('status-update', { status: 'opening' });
      return;
    }

    this.eventSourcePromise = new Promise((resolve, reject) => {
      function onOpen() {
        this.sseClientInitialized = true;
        this.eventSourcePromise = null;
        resolve();
      }
      function onFatalError(err: Error) {
        this.sseClientInitialized = false;
        this.eventSourcePromise = null;
        reject(err);
      }
      const sseOptions: SSEOptions = {
        headers: {},
      };
      let hasOpened = false;

      if (isBrowser) {
        sseOptions.withCredentials = true;
      } else if (isNode) {
        sseOptions.headers.Cookie = this.cookie;
      }
      const es = new EventSource(this.channelUrl, {
        // method: 'PUT',
        // body: '[{"id":0,"action":"poke","ship":"solfer-magfed","app":"hood","mark":"helm-hi","json":null}]',
        headers: {
          accept: 'text/event-stream',
        },
        debug: true,
        withCredentials: true,
        pollingInterval: 0,
      });

      es.addEventListener('open', (_) => {
        // TODO: track reconnect status
        console.log('connectio opened');
        const isReconnect = false;
        this.errorCount = 0;
        hasOpened = true;
        this.onOpen && this.onOpen();
        this.emit('status-update', {
          status: isReconnect ? 'reconnected' : 'active',
        });
        onOpen();
        console.log('Open SSE connection.');
      });

      es.addEventListener('message', (event) => {
        if (this.verbose) {
          console.log('Received SSE: ', event);
        }
        if (!event.lastEventId) {
          return;
        }
        const eventId = parseInt(event.lastEventId, 10);
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
            this.outstandingPokes.has(parseInt(event.lastEventId))
          ) {
            const funcs = this.outstandingPokes.get(
              parseInt(event.lastEventId)
            );
            if (data.hasOwnProperty('ok')) {
              funcs.onSuccess();
            } else if (data.hasOwnProperty('err')) {
              console.error(data.err);
              funcs.onError(data.err);
            } else {
              console.error('Invalid poke response', data);
            }
            this.outstandingPokes.delete(data.id);
          } else if (
            data.response === 'subscribe' &&
            this.outstandingSubscriptions.has(data.id)
          ) {
            const funcs = this.outstandingSubscriptions.get(data.id);
            if (data.hasOwnProperty('err')) {
              console.error(data.err);
              funcs.err(data.err, data.id);
              this.outstandingSubscriptions.delete(data.id);
            }
          } else if (
            data.response === 'diff' &&
            this.outstandingSubscriptions.has(data.id)
          ) {
            const funcs = this.outstandingSubscriptions.get(data.id);
            try {
              funcs.event(data.json, data.mark ?? 'json', data.id);
            } catch (e) {
              console.error('Failed to call subscription event callback', e);
            }
          } else if (
            data.response === 'quit' &&
            this.outstandingSubscriptions.has(data.id)
          ) {
            const funcs = this.outstandingSubscriptions.get(data.id);
            funcs.quit(data);
            this.outstandingSubscriptions.delete(data.id);
            this.emit('subscription', {
              id: data.id,
              status: 'close',
            });
          } else if (this.verbose) {
            console.log([...this.outstandingSubscriptions.keys()]);
            console.log('Unrecognized response', data);
          }
        }
      });

      es.addEventListener('error', (error) => {
        let outError: typeof error | AuthError = error;
        if (error.type === 'error') {
          if (error.xhrStatus === 401 || error.xhrStatus === 403) {
            outError = new AuthError('Auth error', { cause: error });
          }
        }

        this.errorCount++;
        this.emit('error', { time: Date.now(), msg: JSON.stringify(error) });

        if (outError instanceof ReapError) {
          console.log('reap error');
          this.seamlessReset();
          return;
        }
        if (
          !(outError instanceof FatalError) &&
          !(outError instanceof AuthError)
        ) {
          this.emit('status-update', { status: 'reconnecting' });
          this.onRetry && this.onRetry();
          return Math.min(5000, Math.pow(2, this.errorCount - 1) * 750);
        }
        this.emit('status-update', { status: 'errored' });
        console.log('calling onError');
        this.onError && this.onError(outError);
        console.log('rejecting', hasOpened, outError);
        if (!hasOpened) {
          onFatalError(outError);
        }
        throw outError;
      });

      es.addEventListener('close', () => {
        console.log('Close SSE connection.');
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
    this.abort.abort();
    this.abort = new AbortController();
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
      sub.quit({
        id,
        response: 'quit',
      });
      this.emit('subscription', {
        id,
        status: 'close',
      });
    });

    this.outstandingPokes.forEach((poke) => {
      poke.onError('Channel was reaped');
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
    const message: Message = {
      action: 'ack',
      'event-id': eventId,
    };
    await this.sendJSONtoChannel(message);
    return eventId;
  }

  private async sendJSONtoChannel(...json: Message[]): Promise<void> {
    const response = await fetch(this.channelUrl, {
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
    return new Promise<T>(async (resolve, reject) => {
      let done = false;
      let id: number | null = null;
      const quit = () => {
        if (!done) {
          reject('quit');
        }
      };
      const event = (e: T, mark: string, subscriptionId: number) => {
        if (!done) {
          resolve(e);
          this.unsubscribe(subscriptionId);
        }
      };
      const request = { app, path, event, err: reject, quit };

      id = await this.subscribe(request);

      if (timeout) {
        setTimeout(() => {
          if (!done) {
            done = true;
            reject('timeout');
            this.unsubscribe(id);
          }
        }, timeout);
      }
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
    const { app, path, ship, err, event, quit } = {
      err: () => {},
      event: () => {},
      quit: () => {},
      ship: this.ship,
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

  /**
   * Deletes the connection to a channel.
   */
  async delete() {
    const body = JSON.stringify([
      {
        id: this.getEventId(),
        action: 'delete',
      },
    ]);
    if (isBrowser) {
      navigator.sendBeacon(this.channelUrl, body);
    } else {
      const response = await fetch(this.channelUrl, {
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
    const response = await fetch(
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
    const res = await fetch(
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
