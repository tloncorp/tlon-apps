import AsyncStorage from '@react-native-async-storage/async-storage';
import PlatformState from '@tloncorp/app';
import { ENABLED_LOGGERS } from '@tloncorp/app/constants';
// Setup custom dev menu items
import '@tloncorp/app/lib/devMenuItems';
import { setupDb } from '@tloncorp/app/lib/nativeDb';
import { addCustomEnabledLoggers } from '@tloncorp/shared';
import { useDebugStore } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/dist/db';
import { setStorage } from '@tloncorp/ui';
import { registerRootComponent } from 'expo';
import 'expo-dev-client';
import { useEffect } from 'react';
import 'react-native-get-random-values';
import { TailwindProvider } from 'tailwind-rn';

import App from './src/App';
import utilities from './tailwind.json';

// Modifies fetch to support server sent events which
// are required for Urbit client subscriptions
setupDb();
addCustomEnabledLoggers(ENABLED_LOGGERS);
setStorage(AsyncStorage);

function Main(props) {
  useEffect(() => {
    async function init() {
      const appInfo = await db.getAppInfoSettings();
      useDebugStore.getState().initializeDebugInfo(PlatformState, appInfo);
    }

    init();
  }, []);

  return (
    <TailwindProvider utilities={utilities}>
      <App {...props} />
    </TailwindProvider>
  );
}

registerRootComponent(Main);
