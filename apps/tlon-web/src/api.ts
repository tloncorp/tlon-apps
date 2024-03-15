/* eslint-disable import/no-cycle */
import type UrbitMock from '@tloncorp/mock-http-api';
import UrbitBase, {
  Message,
  Poke,
  PokeInterface,
  Scry,
  SubscriptionRequestInterface,
  Thread,
  UrbitHttpApiEvent,
  UrbitHttpApiEventType,
} from '@urbit/http-api';
import _ from 'lodash';

import { useLocalState } from '@/state/local';

import { actionDrill, isHosted, parseKind } from './logic/utils';
import { useEyreState } from './state/eyre';
import useSchedulerStore from './state/scheduler';

export const IS_MOCK =
  import.meta.env.MODE === 'mock' || import.meta.env.MODE === 'staging';
const URL = (import.meta.env.VITE_MOCK_URL ||
  import.meta.env.VITE_VERCEL_URL) as string;

type Hook = (event: any, mark: string) => boolean;

interface Watcher {
  id: string;
  hook: Hook;
  resolve: (value: void | PromiseLike<void>) => void;
  reject: (reason?: any) => void;
}

interface SubscriptionId {
  app: string;
  path: string;
}

function subPath(id: SubscriptionId) {
  return `${id.app}${id.path}`;
}

type EyrePayload = (Message &
  (Poke<any> | Thread<any> | SubscriptionRequestInterface | Scry))[];

function hostingUrl(url: string, messages: EyrePayload) {
  if (!isHosted || messages.length !== 1) {
    return url;
  }

  const json = messages[0];

  if (json.action === 'poke' && 'mark' in json) {
    const base = `${url}?mark=${json.mark}`;
    const actions = json.json ? actionDrill(json.json).join(',') : [];
    const kind = parseKind(json.json);
    const ret =
      actions.length > 0
        ? `${base}&actions=${actions}${kind ? `&kind=${kind}` : ''}`
        : base;
    return ret;
  }

  return url;
}

const Urbit = UrbitBase as new (
  url: string,
  code?: string,
  desk?: string,
  fetch?: typeof window.fetch,
  urlTransformer?: (someUrl: string, json: EyrePayload) => string
) => UrbitBase;

class API {
  private client: UrbitBase | UrbitMock | undefined;

  subscriptions: Set<string>;

  subscriptionMap: Map<number, string>;

  watchers: Record<string, Map<string, Watcher>>;

  constructor() {
    this.subscriptions = new Set();
    this.subscriptionMap = new Map();
    this.watchers = {};
  }

  private async setup() {
    const { showDevTools } = useLocalState.getState();

    if (this.client && this.client.verbose === showDevTools) {
      return this.client;
    }

    if (IS_MOCK) {
      window.ship = 'finned-palmer';
      window.our = `~${window.ship}`;
      window.desk = 'groups';

      const MockUrbit = (await import('@tloncorp/mock-http-api')).default;
      const mockHandlers = (await import('./mocks/handlers')).default;

      this.client = new MockUrbit(mockHandlers, URL || '', '');
      this.client.ship = window.ship;
      this.client.verbose = true;

      return this.client;
    }

    this.client = new Urbit('', '', window.desk, undefined, hostingUrl);
    this.client.ship = window.ship;
    this.client.verbose = showDevTools;

    (this.client as UrbitBase).onReconnect = () => {
      const { onReconnect } = useLocalState.getState();
      if (onReconnect) {
        onReconnect();
      }
    };

    this.client.onRetry = () => {
      useLocalState.setState((state) => ({
        subscription: 'reconnecting',
        errorCount: state.errorCount + 1,
      }));
    };

    this.client.onError = () => {
      (async () => {
        useLocalState.setState((state) => ({
          airLockErrorCount: state.airLockErrorCount + 1,
          subscription: 'disconnected',
        }));
      })();
    };

    return this.client;
  }

  private async withClient<T>(cb: (client: UrbitBase | UrbitMock) => T) {
    const { showDevTools } = useLocalState.getState();

    if (!this.client || this.client.verbose !== showDevTools) {
      const client = await this.setup();
      return cb(client);
    }

    return cb(this.client);
  }

  private async withErrorHandling<T>(
    cb: (client: UrbitBase | UrbitMock) => Promise<T>
  ) {
    try {
      const result = await this.withClient(cb);
      useLocalState.setState({ subscription: 'connected', errorCount: 0 });

      return result;
    } catch (e) {
      useLocalState.setState((state) => ({ errorCount: state.errorCount + 1 }));
      throw e;
    }
  }

  async scry<T>(params: Scry) {
    return this.withClient((client) => client.scry<T>(params));
  }

  async poke<T>(params: PokeInterface<T>) {
    return this.withErrorHandling((client) => client.poke<T>(params));
  }

  private async track<R>(
    subscription: SubscriptionId,
    hook: (event: R) => boolean
  ) {
    const path = subPath(subscription);
    return new Promise((resolve, reject) => {
      const subWatchers = this.watchers[path] || new Map();
      const id = _.uniqueId();

      this.watchers[path] = subWatchers.set(id, {
        id,
        hook,
        resolve,
        reject,
      });
    });
  }

  async trackedPoke<T, R = T>(
    params: PokeInterface<T>,
    subscription: SubscriptionId,
    validator?: (event: R) => boolean
  ) {
    return this.withErrorHandling(
      (client) =>
        new Promise<void>((resolve, reject) => {
          client
            .poke<T>({
              ...params,
              onError: (e) => {
                params.onError?.(e);
                reject();
              },
              onSuccess: async () => {
                params.onSuccess?.();
                const defaultValidator = (event: any) =>
                  _.isEqual(params.json, event);
                await this.track(subscription, validator || defaultValidator);
                resolve();
              },
            })
            .catch(reject);
        })
    );
  }

  async subscribe(params: SubscriptionRequestInterface, priority = 5) {
    const subId = subPath(params);
    if (this.subscriptions.has(subId)) {
      const [id] = [...this.subscriptionMap.entries()].find(
        ([k, v]) => v === subId
      ) || [0, ''];
      return Promise.resolve(id);
    }

    this.subscriptions.add(subId);

    const eventListener =
      (listener?: (event: any, mark: string, id: number) => void) =>
      (event: any, mark: string, id?: number) => {
        const path = params.app + params.path;
        const relevantWatchers = this.watchers[path];

        if (relevantWatchers) {
          relevantWatchers.forEach((w) => {
            if (w.hook(event, mark)) {
              w.resolve();
              relevantWatchers.delete(w.id);
            }
          });
        }

        if (listener) {
          listener(event, mark, id || 0);
        }
      };

    const id = await useSchedulerStore.getState().wait(
      () =>
        this.withErrorHandling((client) =>
          client.subscribe({
            ...params,
            event: eventListener(params.event),
            quit: () => {
              this.client!.subscribe({
                ...params,
                event: eventListener(params.event),
              });

              // should only happen once since we call this each invocation
              // and onReconnect will set the lastReconnect time
              const { lastReconnect, onReconnect } = useLocalState.getState();
              const threshold = import.meta.env.DEV
                ? 60 * 1000
                : 12 * 60 * 60 * 1000; // 12 hours
              if (Date.now() - lastReconnect >= threshold && onReconnect) {
                onReconnect();
              }
            },
          })
        ),
      priority
    );

    this.subscriptionMap.set(id, subId);
    return id;
  }

  async subscribeOnce<T>(app: string, path: string, timeout?: number) {
    return this.withErrorHandling(() =>
      this.client!.subscribeOnce<T>(app, path, timeout)
    );
  }

  async thread<Return, T>(params: Thread<T>) {
    return this.withErrorHandling(() => this.client!.thread<Return, T>(params));
  }

  async unsubscribe(id: number) {
    const subId = this.subscriptionMap.get(id);
    if (subId) {
      this.subscriptions.delete(subId);
      this.subscriptionMap.delete(id);
    }

    return this.withErrorHandling(() => this.client!.unsubscribe(id));
  }

  reset() {
    this.withClient((client) => client.reset());
  }

  on<T extends UrbitHttpApiEventType>(
    event: T,
    callback: (data: UrbitHttpApiEvent[T]) => void
  ) {
    this.withClient((client) => (client as UrbitBase).on(event, callback));
  }
}

const api = new API();
useEyreState.getState().start({ api });

export default api;
