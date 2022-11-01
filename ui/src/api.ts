import type UrbitMock from '@tloncorp/mock-http-api';
import Urbit, {
  PokeInterface,
  Scry,
  SubscriptionRequestInterface,
  Thread,
} from '@urbit/http-api';
import { useLocalState } from './state/local';

export const IS_MOCK =
  import.meta.env.MODE === 'mock' || import.meta.env.MODE === 'staging';
const URL = (import.meta.env.VITE_MOCK_URL ||
  import.meta.env.VITE_VERCEL_URL) as string;

let client = undefined as unknown as Urbit | UrbitMock;

const { errorCount } = useLocalState.getState();

async function setupAPI() {
  if (IS_MOCK) {
    window.ship = 'finned-palmer';
    window.our = `~${window.ship}`;
    window.desk = 'groups';
    const MockUrbit = (await import('@tloncorp/mock-http-api')).default;
    const mockHandlers = (await import('./mocks/handlers')).default;

    if (!client) {
      const api = new MockUrbit(mockHandlers, URL || '', '');
      api.ship = window.ship;
      api.verbose = true;
      client = api;
    }

    return;
  }

  if (!client) {
    const api = new Urbit('', '', window.desk);
    api.ship = window.ship;
    api.verbose = true;
    client = api;
  }
}

const api = {
  async scry<T>(params: Scry) {
    try {
      if (!client) {
        await setupAPI();
      }

      const clientScry = await client.scry<T>(params);
      useLocalState.setState({ subscription: 'connected' });
      useLocalState.setState({ errorCount: 0 });
      return clientScry;
    } catch (e) {
      useLocalState.setState({ subscription: 'disconnected' });
      useLocalState.setState({ errorCount: errorCount + 1 });
      throw e;
    }
  },
  async poke<T>(params: PokeInterface<T>) {
    try {
      if (!client) {
        await setupAPI();
      }

      const clientPoke = await client.poke<T>(params);
      useLocalState.setState({ subscription: 'connected' });
      useLocalState.setState({ errorCount: 0 });
      return clientPoke;
    } catch (e) {
      useLocalState.setState({ subscription: 'disconnected' });
      useLocalState.setState({ errorCount: errorCount + 1 });
      throw e;
    }
  },
  async subscribe(params: SubscriptionRequestInterface) {
    try {
      if (!client) {
        await setupAPI();
      }

      const clientSubscribe = await client.subscribe(params);
      useLocalState.setState({ subscription: 'connected' });
      useLocalState.setState({ errorCount: 0 });
      return clientSubscribe;
    } catch (e) {
      useLocalState.setState({ subscription: 'disconnected' });
      useLocalState.setState({ errorCount: errorCount + 1 });
      throw e;
    }
  },
  async thread<Return, T>(params: Thread<T>) {
    try {
      if (!client) {
        await setupAPI();
      }

      const clientThread = await client.thread<Return, T>(params);
      useLocalState.setState({ subscription: 'connected' });
      useLocalState.setState({ errorCount: 0 });
      return clientThread;
    } catch (e) {
      useLocalState.setState({ subscription: 'disconnected' });
      useLocalState.setState({ errorCount: errorCount + 1 });
      throw e;
    }
  },
  async unsubscribe(id: number) {
    try {
      if (!client) {
        await setupAPI();
      }

      const clientUnsubscribe = await client.unsubscribe(id);
      useLocalState.setState({ subscription: 'connected' });
      useLocalState.setState({ errorCount: 0 });
      return clientUnsubscribe;
    } catch (e) {
      useLocalState.setState({ subscription: 'disconnected' });
      useLocalState.setState({ errorCount: errorCount + 1 });
      throw e;
    }
  },
} as Urbit | UrbitMock;

export default api;
