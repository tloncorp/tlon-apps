import api, { useSubscriptionState } from '@/api';
import { useLocalState } from '@/state/local';
import { putEntry, SettingsUpdate } from '@urbit/api';
import { useEffect } from 'react';
import asyncCallWithTimeout from './asyncWithTimeout';

let disconnectedTries = 0;
const retryTime = 30 * 1000;
let checking = false;

async function checkConnection() {
  try {
    await asyncCallWithTimeout(
      new Promise<void>((resolve, reject) => {
        api.poke({
          ...putEntry(window.desk, 'meta', 'connection', Date.now()),
          onError: () => reject(),
          onSuccess: async () => {
            await useSubscriptionState
              .getState()
              .track(
                `settings-store/desk/${window.desk}`,
                ({
                  'settings-event': event,
                }: {
                  'settings-event': SettingsUpdate;
                }) => {
                  if ('put-entry' in event) {
                    const entry = event['put-entry'];
                    // we just care that we received the event
                    return (
                      entry['bucket-key'] === 'meta' &&
                      entry['entry-key'] === 'connection'
                    );
                  }

                  return false;
                }
              );

            resolve();
          },
        });
      }),
      15000
    );

    disconnectedTries = 0;
    setTimeout(checkConnection, retryTime);
  } catch (error) {
    const { errorCount } = useLocalState.getState();
    disconnectedTries += 1;
    const isDisconnected = errorCount >= 4 || disconnectedTries >= 2;

    if (isDisconnected) {
      useLocalState.setState({ subscription: 'disconnected' });
    } else {
      useLocalState.setState((state) => ({ errorCount: state.errorCount + 1 }));
    }
    // exponential backoff up to 32 mins if disconnected
    setTimeout(
      checkConnection,
      !isDisconnected
        ? retryTime
        : retryTime * 2 ** Math.min(disconnectedTries, 6)
    );
  }
}

export default function useConnectionChecker() {
  useEffect(() => {
    // only ever check once, wait a bit before starting
    if (!checking) {
      checking = true;
      setTimeout(() => checkConnection(), 30 * 1000);
    }
  }, []);
}
