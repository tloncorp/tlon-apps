import {
  createDevLogger,
  initializeLogger,
  toggleAllLogs,
} from '@tloncorp/shared/dist';
import { performUpload } from '@tloncorp/shared/dist/store';
import { format } from 'date-fns';
import * as FileSystem from 'expo-file-system';
import { Alert, Platform } from 'react-native';
import create from 'zustand';

import storage from './storage';

const DEBUG_STORAGE_KEY = 'debug';
const DEBUG_LOG_STORAGE_KEY = 'debug-log';
const devLogger = createDevLogger('debug-tools', false);

interface Log {
  timestamp: number;
  message: string;
}

interface DebugStore {
  enabled: boolean;
  logs: Log[];
  logsUrl: string | null;
  appendLog: (log: Log) => void;
  toggle: (enabled: boolean) => void;
}

export const useDebugStore = create<DebugStore>((set, get) => ({
  enabled: false,
  logs: [],
  logsUrl: null,
  appendLog: (log: Log) => {
    set((state) => ({
      logs: [...state.logs, log],
    }));
  },
  toggle: (enabled) => {
    set(() => ({
      enabled,
    }));
  },
}));

storage
  .load({
    key: DEBUG_STORAGE_KEY,
  })
  .then((enabled) => {
    useDebugStore.getState().toggle(enabled);
    toggleAllLogs(enabled);
  });

// we clear logs on every app start
// storage.save({ key: DEBUG_LOG_STORAGE_KEY, data: [] });

const write = (...args: unknown[]) => {
  const message = args
    .map((arg) => {
      if (!arg) {
        return JSON.stringify(arg);
      }
      if (typeof arg === 'string') {
        return arg;
      }

      if (typeof arg === 'object' && 'toString' in arg) {
        return arg.toString();
      }

      return JSON.stringify(arg);
    })
    .join(' ');

  useDebugStore.getState().appendLog({
    timestamp: Date.now(),
    message,
  });
  // storage.load<Log[]>({ key: DEBUG_LOG_STORAGE_KEY }).then((logs) => {
  //   logs.push({
  //     timestamp: Date.now(),
  //     message,
  //   });
  //   storage.save({
  //     key: DEBUG_LOG_STORAGE_KEY,
  //     data: logs,
  //   });
  // });
};

const logger = {
  log: (...args: unknown[]) => {
    if (useDebugStore.getState().enabled) {
      write(args);
    }

    if (!__DEV__) {
      return;
    }

    console.log(...args);
  },
  warn: (...args: unknown[]) => {
    if (useDebugStore.getState().enabled) {
      write(args);
    }

    if (!__DEV__) {
      return;
    }

    console.warn(...args);
  },
  debug: (...args: unknown[]) => {
    if (useDebugStore.getState().enabled) {
      write(args);
    }

    if (!__DEV__) {
      return;
    }

    console.debug(...args);
  },
  error: (...args: unknown[]) => {
    if (useDebugStore.getState().enabled) {
      write(args);
    }

    if (!__DEV__) {
      return;
    }

    console.error(...args);
  },
} as Console;

export const initializeDebug = () => {
  initializeLogger(logger);
};

export const toggleDebug = async (enabled: boolean) => {
  useDebugStore.getState().toggle(enabled);
  await storage.save({
    key: DEBUG_STORAGE_KEY,
    data: enabled,
  });

  toggleAllLogs(enabled);

  if (enabled) {
    console.log('Debug mode enabled');

    Alert.alert(
      'Debug mode enabled',
      'Debug mode is now enabled. You may experience some degraded performance, because logs will be captured as you use the app. To get the best capture, you should kill the app and open it again.',
      [
        {
          text: 'OK',
        },
      ]
    );
  } else {
    console.log('Debug mode disabled');
  }
};

export async function uploadLogs() {
  const filename = `tlon-debug-log-${format(new Date(), 'M-d-yy-HH-mm')}`;
  const contents = (
    await storage.load<Log[]>({ key: DEBUG_LOG_STORAGE_KEY })
  ).join('\n');
  if (Platform.OS === 'ios') {
    if (!FileSystem.documentDirectory) {
      logger.log();
      return;
    }
    const uri = FileSystem.documentDirectory + filename + '.txt';
    // await FileSystem.
    await FileSystem.writeAsStringAsync(uri, contents, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const url = await performUpload({ uri }, false);
    useDebugStore.setState({ logsUrl: url });
  } else if (Platform.OS === 'android') {
    const permissions =
      await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permissions.granted) {
      return;
    }

    if (!FileSystem.documentDirectory) {
      return;
    }

    const uri = await FileSystem.StorageAccessFramework.createFileAsync(
      FileSystem.documentDirectory,
      filename,
      'text/plain'
    );

    await FileSystem.StorageAccessFramework.writeAsStringAsync(uri, contents);

    const url = await performUpload({ uri }, false);
    useDebugStore.setState({ logsUrl: url });
  }
}
