import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { PostHogProvider, usePostHog } from 'posthog-react-native';
import { useTailwind } from 'tailwind-rn';
import {
  SafeAreaView,
  Text,
  StatusBar,
  ActivityIndicator,
  View,
} from 'react-native';
import useStore, { readShipConnection } from './state/store';
import WebApp from './WebApp';
import Login from './Login';
import { initNotifications } from './lib/notifications';
import { POST_HOG_API_KEY, URBIT_HOME_REGEX } from './constants';

initNotifications();

const App = () => {
  const tailwind = useTailwind();
  const postHog = usePostHog();
  const { loading, setLoading, ship, shipUrl, setShip } = useStore();
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const shipConnection = await readShipConnection();
        if (shipConnection?.shipUrl) {
          const response = await fetch(shipConnection.shipUrl);
          const html = await response.text();
          if (URBIT_HOME_REGEX.test(html)) {
            setShip(shipConnection);
            setTimeout(() => setLoading(false), 750);
          } else {
            setLoading(false);
          }
        }
      } catch (err: any) {
        if (err.name !== 'NotFoundError') {
          console.error('Error reading ship connection from storage', err);
        }

        setLoading(false);
      }
    })();

    const unsubscribeFromNetInfo = NetInfo.addEventListener(
      ({ isConnected }) => {
        setConnected(isConnected ?? true);
      }
    );

    return () => {
      unsubscribeFromNetInfo();
    };
  }, []);

  useEffect(() => {
    if (ship) {
      postHog?.identify(ship, { shipUrl });
    }
  }, [ship, shipUrl]);

  return (
    <SafeAreaView style={tailwind('h-full w-full bg-white')} ph-no-capture>
      {connected ? (
        loading ? (
          <View style={tailwind('h-full flex items-center justify-center')}>
            <ActivityIndicator size="large" color="#000" />
          </View>
        ) : ship ? (
          <WebApp />
        ) : (
          <Login />
        )
      ) : (
        <View style={tailwind('h-full p-4 flex items-center justify-center')}>
          <Text style={tailwind('text-center text-xl font-semibold')}>
            Your are offline. Please connect to the internet and try again.
          </Text>
        </View>
      )}
      <StatusBar backgroundColor="white" barStyle="dark-content" />
    </SafeAreaView>
  );
};

export default function AnalyticsApp() {
  return (
    <PostHogProvider
      apiKey={POST_HOG_API_KEY}
      options={{ host: 'https://eu.posthog.com', enable: !__DEV__ }}
      autocapture
    >
      <App />
    </PostHogProvider>
  );
}
