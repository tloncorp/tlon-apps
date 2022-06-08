import type UrbitMock from '@tloncorp/mock-http-api';
import Urbit, {
  PokeInterface,
  Scry,
  SubscriptionRequestInterface,
  Thread,
} from '@urbit/http-api';

export const IS_MOCK =
  import.meta.env.MODE === 'mock' ||
  import.meta.env.MODE === 'staging' ||
  import.meta.env.MODE === 'chatmock';
const URL = (import.meta.env.VITE_MOCK_URL ||
  import.meta.env.VITE_VERCEL_URL) as string;

let _api = undefined as unknown as Urbit | UrbitMock;

async function setupAPI() {
  if (IS_MOCK) {
    window.ship = '~zod';
    window.our = '~zod';
    window.desk = 'homestead';
    const MockUrbit = (await import('@tloncorp/mock-http-api')).default;
    const mockHandlers = (await import('./mocks/handlers')).default;

    if (!_api) {
      const api = new MockUrbit(mockHandlers, URL || '', '');
      api.ship = window.ship;
      api.verbose = true;
      _api = api;
    }

    return;
  }

  if (!_api) {
    const api = new Urbit('', '', window.desk);
    api.ship = window.ship;
    api.verbose = true;
    _api = api;
  }
}

const api = {
  scry: async function <T>(params: Scry) {
    debugger;
    if (!_api) {
      await setupAPI();
    }

    return _api.scry<T>(params);
  },
  poke: async function <T>(params: PokeInterface<T>) {
    if (!_api) {
      await setupAPI();
    }

    return _api.poke<T>(params);
  },
  subscribe: async function (params: SubscriptionRequestInterface) {
    if (!_api) {
      await setupAPI();
    }

    return _api.subscribe(params);
  },
  thread: async function <Return, T>(params: Thread<T>) {
    if (!_api) {
      await setupAPI();
    }

    return _api.thread<Return, T>(params);
  },
  unsubscribe: async function (id: number) {
    if (!_api) {
      await setupAPI();
    }

    return _api.unsubscribe(id);
  },
} as Urbit | UrbitMock;

export default api;
