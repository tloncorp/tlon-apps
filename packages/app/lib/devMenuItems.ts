import { registerDevMenuItems } from 'expo-dev-menu';
import {
  Alert,
  Clipboard,
  DevSettings,
  NativeModules,
  Share,
} from 'react-native';

// Since we're relying on state local to this module, we need to ensure that we
// import from the same location that other callers import it from (i.e. don't
// import from `@tloncorp/shared/src/db` because `tlon-mobile` largely imports
// from `@tloncorp/shared/dist/store`, which transitively hits `QueryLogger`
// via the post-bundler `dist`).
import { QueryLogger } from '../../../packages/shared/dist/db';
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
  {
    name: 'Start capturing query logs',
    callback: async () => {
      const logger = QueryLogger.shared;
      logger.clear();
      logger.paused = false;

      Alert.alert('Enabled query logging');
    },
  },
  {
    name: 'Print query logs',
    callback: async () => {
      const logger = QueryLogger.shared;
      const csv = logger.toCsv();
      if (csv == null) {
        Alert.alert(
          'No query logs captured',
          logger.paused ? 'Query logs are paused' : undefined,

          logger.paused
            ? [
                {
                  text: 'Start capturing',
                  onPress: () => {
                    logger.clear();
                    logger.paused = false;
                  },
                },
                { text: 'Close' },
              ]
            : undefined
        );
        return;
      }

      logger.paused = true;
      logger.clear();

      console.log('\n' + csv);
      Alert.alert(
        'Query logs printed to console',
        'Logs have also been paused',
        [
          { text: 'Close', style: 'cancel' },
          {
            text: 'Copy to clipboard',
            onPress: () => {
              Clipboard.setString(csv);
            },
          },
          {
            text: 'Share...',
            onPress: async () => {
              await Share.share({ message: csv });
            },
          },
        ]
      );
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
