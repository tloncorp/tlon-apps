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
      const path = getDbPath() ?? '';
      sendBundlerRequest('open-sqlite', { path });
    },
  },
  {
    name: 'Dump sqlite database',
    callback: async () => {
      const path = getDbPath() ?? '';
      sendBundlerRequest('dump-sqlite', { path });
    },
  },
];

async function sendBundlerRequest(
  path: string,
  params: Record<string, string>
) {
  if (!metroBundlerURL) {
    console.warn('no metroBundlerURL');
    return;
  }
  const url =
    metroBundlerURL + path + '?' + new URLSearchParams(params).toString();
  console.log('sending request to metro bundler:', url);
  try {
    await fetch(url);
  } catch (e) {
    console.log(e);
  }
}

registerDevMenuItems(devMenuItems);
