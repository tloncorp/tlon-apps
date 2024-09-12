import * as api from '@tloncorp/shared/dist/api';
import { registerDevMenuItems } from 'expo-dev-menu';
import { Alert, DevSettings, NativeModules } from 'react-native';
import * as DeviceInfo from 'react-native-device-info';

import { getDbPath, purgeDb } from './nativeDb';

let metroBundlerURL: string | null = null;
if (__DEV__) {
  const scriptURL = NativeModules.SourceCode.scriptURL;
  metroBundlerURL = scriptURL.split('index.bundle?')[0] ?? null;
}

type ExpoDevMenuItem = Parameters<typeof registerDevMenuItems>[0][0];

const simulatorOnlyMenuItems: ExpoDevMenuItem[] = [
  {
    name: 'Drizzle studio',
    callback: async () => {
      const path = getDbPath() ?? '';
      sendBundlerRequest('open-sqlite', { path });
    },
  },
  {
    name: 'Dump SQLite',
    callback: async () => {
      const outputPath = process.env.SQLITE_DUMP_PATH ?? 'dump.sqlite3';
      const databaseSourcePath = getDbPath() ?? '';

      sendBundlerRequest('dump-sqlite', { databaseSourcePath, outputPath });
    },
  },
  {
    name: 'Restore SQLite',
    callback: async () => {
      const sourcePath = process.env.SQLITE_RESTORE_PATH ?? 'restore.sqlite3';
      const localDatabasePath = getDbPath();
      if (localDatabasePath == null) {
        Alert.alert('Could not find database path');
        return;
      }

      const overwriteDatabase = async () => {
        await sendBundlerRequest('restore-sqlite', {
          sourcePath,
          targetPath: localDatabasePath,
        });
      };

      Alert.alert(
        'Overwrite local database?',
        `This will overwrite your local database with the file on the Metro host at ${sourcePath}.`,
        [
          {
            text: 'Overwrite and restart app',
            onPress: async () => {
              await overwriteDatabase();
              DevSettings.reload('Restoring SQLite database');
            },
          },
          {
            text: 'Overwrite and reset queries (faster, may cause issues)',
            onPress: async () => {
              await overwriteDatabase();
              api.queryClient.resetQueries();
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    },
  },
];

const devMenuItems: Promise<ExpoDevMenuItem[]> = DeviceInfo.isEmulator().then(
  (isEmulator) => [
    {
      name: 'Delete local database',
      callback: () => purgeDb(),
    },
    ...(isEmulator ? simulatorOnlyMenuItems : []),
  ]
);

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

devMenuItems.then((items) => registerDevMenuItems(items));
