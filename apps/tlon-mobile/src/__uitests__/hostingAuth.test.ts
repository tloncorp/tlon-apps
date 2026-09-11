import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import NetInfo from '@react-native-community/netinfo';
import { getHostingHeartBeat } from '@tloncorp/api';
import * as db from '@tloncorp/shared/db';

import { refreshHostingAuth } from '../lib/hostingAuth';

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: jest.fn() },
}));

jest.mock('@react-native-cookies/cookies', () => ({
  __esModule: true,
  default: {},
}));

jest.mock(
  '@tloncorp/api',
  () => ({
    getHostingHeartBeat: jest.fn(),
  }),
  { virtual: true }
);

jest.mock('@tloncorp/shared', () => ({
  createDevLogger: () => ({
    crumb: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
    trackEvent: jest.fn(),
  }),
}));

jest.mock('@tloncorp/shared/db', () => ({
  hostingAuthExpired: {
    getValue: jest.fn(),
    setValue: jest.fn(),
  },
  hostingLastAuthCheck: {
    getValue: jest.fn(),
    setValue: jest.fn(),
  },
  shipInfo: {
    getValue: jest.fn(),
  },
}));

jest.mock('@tloncorp/shared/domain', () => ({
  getConstants: jest.fn(),
}));

const originalDev = __DEV__;
const runtimeGlobal = globalThis as typeof globalThis & { __DEV__: boolean };

describe('refreshHostingAuth', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    runtimeGlobal.__DEV__ = false;
    jest.clearAllMocks();
    jest.mocked(db.shipInfo.getValue).mockResolvedValue({
      authType: 'hosted',
      ship: '~zod',
      shipUrl: 'https://zod.tlon.network',
      authCookie: 'urbauth',
    });
    jest.mocked(db.hostingAuthExpired.getValue).mockResolvedValue(false);
    jest.mocked(db.hostingLastAuthCheck.getValue).mockResolvedValue(0);
    jest.mocked(db.hostingAuthExpired.setValue).mockResolvedValue();
    jest.mocked(db.hostingLastAuthCheck.setValue).mockResolvedValue();
    jest.mocked(NetInfo.fetch).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    } as unknown as Awaited<ReturnType<typeof NetInfo.fetch>>);
    jest.mocked(getHostingHeartBeat).mockResolvedValue('ok');
  });

  afterAll(() => {
    runtimeGlobal.__DEV__ = originalDev;
  });

  it('skips Hosting for self-hosted sessions', async () => {
    await expect(
      refreshHostingAuth({ authType: 'self', force: true })
    ).resolves.toBe('skipped');

    expect(db.hostingAuthExpired.getValue).not.toHaveBeenCalled();
    expect(getHostingHeartBeat).not.toHaveBeenCalled();
  });

  it('returns a previously detected expiration without making a request', async () => {
    runtimeGlobal.__DEV__ = true;
    jest.mocked(db.hostingAuthExpired.getValue).mockResolvedValue(true);

    await expect(refreshHostingAuth({ authType: 'hosted' })).resolves.toBe(
      'expired'
    );

    expect(getHostingHeartBeat).not.toHaveBeenCalled();
  });

  it('persists a newly expired Hosting session', async () => {
    jest.mocked(getHostingHeartBeat).mockResolvedValue('expired');
    jest.spyOn(Date, 'now').mockReturnValue(1234);

    await expect(
      refreshHostingAuth({ authType: 'hosted', force: true })
    ).resolves.toBe('expired');

    expect(db.hostingAuthExpired.setValue).toHaveBeenCalledWith(true);
    expect(db.hostingLastAuthCheck.setValue).toHaveBeenCalledWith(1234);
  });

  it('records a successful refresh', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(5678);

    await expect(
      refreshHostingAuth({ authType: 'hosted', force: true })
    ).resolves.toBe('ok');

    expect(db.hostingAuthExpired.setValue).not.toHaveBeenCalled();
    expect(db.hostingLastAuthCheck.setValue).toHaveBeenCalledWith(5678);
  });

  it('records an indeterminate refresh attempt', async () => {
    jest.mocked(getHostingHeartBeat).mockResolvedValue('unknown');
    jest.spyOn(Date, 'now').mockReturnValue(9012);

    await expect(
      refreshHostingAuth({ authType: 'hosted', force: true })
    ).resolves.toBe('unknown');

    expect(db.hostingAuthExpired.setValue).not.toHaveBeenCalled();
    expect(db.hostingLastAuthCheck.setValue).toHaveBeenCalledWith(9012);
  });
});
