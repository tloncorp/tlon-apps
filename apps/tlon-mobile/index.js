import AsyncStorage from '@react-native-async-storage/async-storage';
import { ENABLED_LOGGERS } from '@tloncorp/app/constants';
import { initializeDebug } from '@tloncorp/app/lib/debug';
// Setup custom dev menu items
import '@tloncorp/app/lib/devMenuItems';
import { setupDb } from '@tloncorp/app/lib/nativeDb';
import { addCustomEnabledLoggers } from '@tloncorp/shared';
import { setStorage } from '@tloncorp/ui';
import { registerRootComponent } from 'expo';
import 'expo-dev-client';
import 'react-native-get-random-values';
import { TailwindProvider } from 'tailwind-rn';

import App from './src/App';
import utilities from './tailwind.json';

initializeDebug();

// Modifies fetch to support server sent events which
// are required for Urbit client subscriptions
setupDb();
addCustomEnabledLoggers(ENABLED_LOGGERS);
setStorage(AsyncStorage);

function Main(props) {
  return (
    <TailwindProvider utilities={utilities}>
      <App {...props} />
    </TailwindProvider>
  );
}

registerRootComponent(Main);
