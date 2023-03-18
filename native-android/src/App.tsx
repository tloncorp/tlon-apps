import { useCallback, useEffect, useRef, useState } from 'react';
import { useTailwind } from 'tailwind-rn';
import * as Network from 'expo-network';
import {
  AppState,
  AppStateStatus,
  SafeAreaView,
  Text,
  StatusBar,
  ActivityIndicator,
  View
} from 'react-native';
import useStore from './state/store';
import WebApp from './WebApp';
import storage from './lib/storage';
import { URBIT_HOME_REGEX } from './lib/util';
import Login from './Login';

export default function App() {
  const tailwind = useTailwind();
  const {
    loading,
    setLoading,
    ship,
    shipUrl,
    authCookie,
    loadStore,
    needLogin,
    setNeedLogin,
    setShip
  } = useStore();
  const [connected, setConnected] = useState(false);
  const appState = useRef(AppState.currentState);

  const checkNetwork = useCallback(async () => {
    const networkState = await Network.getNetworkStateAsync();
    setConnected(Boolean(networkState.isInternetReachable));
  }, [setConnected]);

  useEffect(() => {
    const loadStorage = async () => {
      try {
        const res = await storage.load({ key: 'store' });

        if (res?.shipUrl) {
          const response = await fetch(res.shipUrl);
          const html = await response?.text();

          if (html && URBIT_HOME_REGEX.test(html)) {
            loadStore(res);
            setNeedLogin(false);
          }
        }

        setTimeout(() => setLoading(false), 500);
      } catch (e: any) {
        if (e.name !== 'NotFoundError') {
          console.error(e);
        }
        setLoading(false);
      }
    };
    loadStorage();
    checkNetwork();

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        checkNetwork();
      }

      appState.current = nextAppState;
    };

    const appStateListener = AppState.addEventListener(
      'change',
      handleAppStateChange
    );

    return () => {
      appStateListener.remove();
    };
  }, []);

  if (!connected) {
    return (
      <SafeAreaView style={tailwind('h-full w-full flex flex-col')}>
        <Text style={tailwind('text-center text-xl')}>
          Your are offline. Please connect to the internet and try again.
        </Text>
        <StatusBar backgroundColor="white" barStyle="dark-content" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={tailwind('h-full bg-white w-full')}>
      {loading ? (
        <View style={tailwind('text-center p-4')}>
          <ActivityIndicator size="large" color="#000" />
        </View>
      ) : needLogin && (!shipUrl || !ship || !authCookie) ? (
        <Login />
      ) : (
        <WebApp />
      )}
      <StatusBar backgroundColor="white" barStyle="dark-content" />
    </SafeAreaView>
  );
}
