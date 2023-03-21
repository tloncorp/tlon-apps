import Urbit from '@uqbar/react-native-api';
import { configureApi } from '@uqbar/react-native-api/configureApi';
import { PokeInterface, Scry, Thread } from '@urbit/http-api';
import { useLocalState } from './state/local';
import useSubscriptionState from './state/subscription';

let client = undefined as unknown as Urbit;

const { errorCount, airLockErrorCount } = useLocalState.getState();

async function setupAPI(ship: string, shipUrl: string) {
  if (!client) {
    const api = configureApi(ship, shipUrl);
    api.ship = ship;
    api.verbose = true;
    client = api;
  }

  client.onError = () => {
    (async () => {
      useLocalState.setState({ airLockErrorCount: airLockErrorCount + 1 });
      useLocalState.setState({ subscription: 'reconnecting' });
    })();
  };
}

const api = (ship: string, shipUrl: string) =>
  ({
    async scry<T>(params: Scry) {
      if (!client) {
        await setupAPI(ship, shipUrl);
      }

      return client.scry<T>(params);
    },
    async poke<T>(params: PokeInterface<T>) {
      try {
        if (!client) {
          await setupAPI(ship, shipUrl);
        }

        const clientPoke = await client.poke(params);
        useLocalState.setState({ subscription: 'connected' });
        useLocalState.setState({ errorCount: 0 });

        return clientPoke;
      } catch (e) {
        useLocalState.setState({ errorCount: errorCount + 1 });
        throw e;
      }
    },
    async subscribe(params: {
      app: string;
      path: string;
      ship?: string;
      err?: (payload?: any) => void;
      event?: (payload?: any) => void;
      quit?: (payload?: any) => void;
    }) {
      const eventListener =
        (listener?: (event: any, mark: string) => void) =>
        (payload: { event: any; mark: string }) => {
          console.log({ payload });
          const { event, mark } = payload;
          const { watchers, remove } = useSubscriptionState.getState();
          const path = params.app + params.path;
          const relevantWatchers = watchers[path];

          if (relevantWatchers) {
            relevantWatchers.forEach(w => {
              if (w.hook(event, mark)) {
                w.resolve();
                remove(path, w.id);
              }
            });
          }

          if (listener) {
            listener(event, mark);
          }
        };

      try {
        if (!client) {
          await setupAPI(ship, shipUrl);
        }

        const clientSubscribe = await client.subscribe({
          ...params,
          event: eventListener(params.event)
        });
        useLocalState.setState({ subscription: 'connected' });
        useLocalState.setState({ errorCount: 0 });
        return clientSubscribe;
      } catch (e) {
        console.log('error in subscribe: ', e);
        useLocalState.setState({ errorCount: errorCount + 1 });
        throw e;
      }
    },
    async subscribeOnce<T>(app: string, path: string, timeout?: number) {
      try {
        if (!client) {
          await setupAPI(ship, shipUrl);
        }

        const clientPoke = await client.subscribeOnce(
          app,
          path,
          timeout || 5000
        );
        useLocalState.setState({ subscription: 'connected' });
        useLocalState.setState({ errorCount: 0 });

        return clientPoke;
      } catch (e) {
        useLocalState.setState({ errorCount: errorCount + 1 });
        throw e;
      }
    },
    async thread<Return, T>(params: Thread<T>) {
      try {
        if (!client) {
          await setupAPI(ship, shipUrl);
        }

        const clientThread = await client.thread(params);
        useLocalState.setState({ subscription: 'connected' });
        useLocalState.setState({ errorCount: 0 });
        return clientThread;
      } catch (e) {
        useLocalState.setState({ errorCount: errorCount + 1 });
        throw e;
      }
    },
    async unsubscribe(id: number) {
      try {
        if (!client) {
          await setupAPI(ship, shipUrl);
        }

        const clientUnsubscribe = await client.unsubscribe(id);
        useLocalState.setState({ subscription: 'connected' });
        useLocalState.setState({ errorCount: 0 });
        return clientUnsubscribe;
      } catch (e) {
        useLocalState.setState({ errorCount: errorCount + 1 });
        throw e;
      }
    },
    reset() {
      client.reset();
    }
  } as Urbit);

export default api;
