import { registerDevMenuItems } from 'expo-dev-menu';
import { NativeModules } from 'react-native';

import { getDbPath, purgeDb } from './nativeDb';

let metroBundlerURL: string | null = null;
if (__DEV__) {
  const scriptURL = NativeModules.SourceCode.scriptURL;
  metroBundlerURL = scriptURL.split('index.bundle?')[0] ?? null;
}

const devMenuItems = [
  {
    name: 'Delete local database',
    callback: () => purgeDb(),
  },
  {
    name: 'Drizzle studio (simulator only)',
    callback: async () => {
      const path = getDbPath();
      if (!path || !metroBundlerURL) {
        console.warn(
          'unable to open db, path or metroBundlerURL missing',
          path,
          metroBundlerURL
        );
      }
      const url =
        metroBundlerURL +
        'open-sqlite?path=' +
        encodeURIComponent(getDbPath() ?? '');
      console.log('opening drizzle studio at url:', url);
      try {
        await fetch(url);
      } catch (e) {
        console.log(e);
      }
    },
  },
];

registerDevMenuItems(devMenuItems);
