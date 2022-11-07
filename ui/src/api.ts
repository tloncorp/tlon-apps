import type UrbitMock from '@tloncorp/mock-http-api';
import Urbit, {
  PokeInterface,
  Scry,
  SubscriptionRequestInterface,
  Thread,
} from '@urbit/http-api';
import { SubscriptionStatus, useLocalState } from './state/local';

export const IS_MOCK =
  import.meta.env.MODE === 'mock' || import.meta.env.MODE === 'staging';
const URL = (import.meta.env.VITE_MOCK_URL ||
  import.meta.env.VITE_VERCEL_URL) as string;

let client = undefined as unknown as Urbit | UrbitMock;

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

function resetConnection(errorCount: number, subscription: SubscriptionStatus) {
  if (subscription !== 'connected') {
    console.log('resetting status', subscription);
    useLocalState.setState({ subscription: 'connected' });
  }

  if (errorCount !== 0) {
    console.log('resetting error count', errorCount);
    useLocalState.setState({ errorCount: 0 });
  }
}

const api = {
  async scry<T>(params: Scry) {
    if (!client) {
      await setupAPI();
    }

    return client.scry<T>(params);
  },
  async poke<T>(params: PokeInterface<T>) {
    const { subscription, errorCount } = useLocalState.getState();
    try {
      if (!client) {
        await setupAPI();
      }

      const clientPoke = await client.poke<T>(params);
      resetConnection(errorCount, subscription);
      return clientPoke;
    } catch (e) {
      console.log('poke error', errorCount);
      useLocalState.setState({ subscription: 'disconnected' });
      useLocalState.setState({ errorCount: errorCount + 1 });
      throw e;
    }
  },
  async subscribe(params: SubscriptionRequestInterface) {
    const { subscription, errorCount } = useLocalState.getState();
    try {
      if (!client) {
        await setupAPI();
      }

      const clientSubscribe = await client.subscribe(params);
      resetConnection(errorCount, subscription);
      return clientSubscribe;
    } catch (e) {
      console.log('subscribe error', errorCount);
      useLocalState.setState({ subscription: 'disconnected' });
      useLocalState.setState({ errorCount: errorCount + 1 });
      throw e;
    }
  },
  async thread<Return, T>(params: Thread<T>) {
    const { subscription, errorCount } = useLocalState.getState();
    try {
      if (!client) {
        await setupAPI();
      }

      const clientThread = await client.thread<Return, T>(params);
      resetConnection(errorCount, subscription);
      return clientThread;
    } catch (e) {
      console.log('thread error', errorCount);
      useLocalState.setState({ subscription: 'disconnected' });
      useLocalState.setState({ errorCount: errorCount + 1 });
      throw e;
    }
  },
  async unsubscribe(id: number) {
    const { subscription, errorCount } = useLocalState.getState();
    try {
      if (!client) {
        await setupAPI();
      }

      const clientUnsubscribe = await client.unsubscribe(id);
      resetConnection(errorCount, subscription);
      return clientUnsubscribe;
    } catch (e) {
      console.log('unsubscribe error', errorCount);
      useLocalState.setState({ subscription: 'disconnected' });
      useLocalState.setState({ errorCount: errorCount + 1 });
      throw e;
    }
  },
} as Urbit | UrbitMock;

export default api;
