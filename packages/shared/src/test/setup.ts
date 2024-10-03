import dotenv from 'dotenv';
import { vi } from 'vitest';

import { Client } from '../api/urbit';
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

export function mockUrbit() {
  vi.mock('../api/urbit', async (importOriginal) => {
    const mod = await importOriginal<typeof import('../api/urbit')>();
    const out: typeof mod = {
      ...mod,
      client: vi.mocked({
        scry: vi.fn(),
        trackedPoke: vi.fn(),
      } as any as Client),
      getCurrentUserId: () => '~solfer-magfed',
    };
    return out;
  });
}
