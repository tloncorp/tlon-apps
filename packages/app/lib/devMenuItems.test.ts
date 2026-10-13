import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const registerDevMenuItems = vi.hoisted(() =>
  vi.fn(async (_items: { name: string }[]) => undefined)
);
const isEmulator = vi.hoisted(() => vi.fn(async () => false));

vi.mock('expo-dev-menu', () => ({ registerDevMenuItems }));
vi.mock('react-native-device-info', () => ({ isEmulator }));
vi.mock('expo-constants', () => ({
  default: { expoConfig: { hostUri: 'localhost:8081' } },
}));
vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
  DevSettings: { reload: vi.fn() },
}));
vi.mock('@tloncorp/shared', () => ({
  syncSince: vi.fn(),
  queryClient: { resetQueries: vi.fn() },
}));
vi.mock('./nativeDb', () => ({ getDbPath: vi.fn(), purgeDb: vi.fn() }));
vi.mock('./notifications', () => ({ discoverContactsAndNotify: vi.fn() }));

async function importWithDev(dev: boolean) {
  vi.stubGlobal('__DEV__', dev);
  vi.resetModules();
  await vi.importActual('./devMenuItems');
  // Let the isEmulator().then(...) chain settle.
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function registeredNames() {
  return registerDevMenuItems.mock.calls[0][0].map((item) => item.name);
}

describe('devMenuItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('never touches expo-dev-menu in release builds', async () => {
    await importWithDev(false);

    expect(isEmulator).not.toHaveBeenCalled();
    expect(registerDevMenuItems).not.toHaveBeenCalled();
  });

  it('registers device items in development builds', async () => {
    isEmulator.mockResolvedValueOnce(false);

    await importWithDev(true);

    expect(registerDevMenuItems).toHaveBeenCalledTimes(1);
    expect(registeredNames()).toContain('Delete local database');
    expect(registeredNames()).not.toContain('Drizzle studio');
  });

  it('adds simulator-only items when running in an emulator', async () => {
    isEmulator.mockResolvedValueOnce(true);

    await importWithDev(true);

    expect(registerDevMenuItems).toHaveBeenCalledTimes(1);
    expect(registeredNames()).toContain('Drizzle studio');
  });
});
