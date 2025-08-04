import dotenv from 'dotenv';
import { vi } from 'vitest';

import { addCustomEnabledLoggers } from '../debug';

// @ts-expect-error needed to import files that reference __DEV__
global.__DEV__ = true;

dotenv.config({ path: __dirname + '/../../.env.test' });
const loggers = process.env.ENABLED_LOGGERS?.split(',') ?? [];

addCustomEnabledLoggers(loggers);

vi.mock('@react-native-firebase/crashlytics', () => {
  return {
    log: vi.fn(),
    recordError: vi.fn(),
    setUserId: vi.fn(),
  };
});

vi.mock('@react-native-community/netinfo', () => {
  return {
    fetch: async () => ({ isConnected: true, type: 'wifi' }),
  };
});

vi.mock('expo-file-system', () => ({
  uploadAsync: vi.fn(),
}));

vi.mock('expo-image-manipulator', () => ({
  manipulateAsync: vi.fn().mockResolvedValue({
    uri: 'manipulated-image-uri',
    width: 1,
    height: 1,
  }),
}));

vi.mock('../db/getStorageMethods', () => {
  return {
    getStorageMethods() {
      return {
        getItem(key: string) {},
        setItem(key: string, value: any) {},
        removeItem(key: string, value: any) {},
      };
    },
  };
});

vi.mock('../store/storage', async (importOriginal) => {
  return {
    ...((await importOriginal()) as Record<string, unknown>),
    uploadAsset: vi.fn().mockResolvedValue(undefined),
  };
});

export function mockUrbit() {
  vi.mock('../api/urbit', async (importOriginal) => {
    const mod = await importOriginal<typeof import('../api/urbit')>();
    const out: typeof mod = {
      ...mod,
      scry: vi.fn(),
      trackedPoke: vi.fn(),
      poke: vi.fn(),
      getCurrentUserId: () => '~solfer-magfed',
    };
    return out;
  });
}
