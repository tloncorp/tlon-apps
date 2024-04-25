import AsyncStorage from '@react-native-async-storage/async-storage';
import { addCustomEnabledLoggers } from '@tloncorp/shared';
import { setStorage } from '@tloncorp/ui';
import { registerRootComponent } from 'expo';
import 'expo-dev-client';
import polyfill from 'react-native-polyfill-globals';
import { TailwindProvider } from 'tailwind-rn';

import App from './src/App';
import { ENABLED_LOGGERS } from './src/constants';
// Setup custom dev menu items
import './src/lib/devMenuItems';
import { setupDb } from './src/lib/nativeDb';
import utilities from './tailwind.json';

// Modifies fetch to support server sent events which
// are required for Urbit client subscriptions
polyfill();
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
