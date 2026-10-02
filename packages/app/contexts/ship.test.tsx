import React, { useEffect } from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ShipInfo } from '@tloncorp/shared/db';

vi.hoisted(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

const mocks = vi.hoisted(() => ({
  setValue: vi.fn(),
  resetValue: vi.fn(),
}));

vi.mock('@react-native-firebase/crashlytics', () => ({
  default: () => ({ setAttribute: vi.fn() }),
}));

vi.mock('@tloncorp/api/lib/urbit', () => ({ preSig: (ship: string) => ship }));

vi.mock('@tloncorp/shared', () => ({
  AnalyticsEvent: { NodeAuthSaved: 'Node Auth Saved' },
  createDevLogger: () => ({
    error: vi.fn(),
    trackEvent: vi.fn(),
  }),
}));

vi.mock('@tloncorp/shared/db', () => ({
  storage: {
    shipInfo: {
      getValue: vi.fn(),
      resetValue: mocks.resetValue,
      setValue: mocks.setValue,
    },
  },
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
  TurboModuleRegistry: { get: vi.fn() },
}));

vi.mock('../lib/notifications', () => ({
  cancelNodeResumeNudge: vi.fn(async () => {}),
}));

vi.mock('../utils/string', () => ({ transformShipURL: (url: string) => url }));

import { ShipProvider, useShip } from './ship';

const initialShip: ShipInfo = {
  authType: 'hosted',
  ship: '~zod',
  shipUrl: 'https://zod.test',
  authCookie: 'urbauth=stale',
};

let currentShip!: ReturnType<typeof useShip>;
let renderer: ReactTestRenderer | null = null;

function Probe() {
  const ship = useShip();
  useEffect(() => {
    currentShip = ship;
  });
  return null;
}

function renderProvider() {
  act(() => {
    renderer = create(
      <ShipProvider initialShipInfo={initialShip}>
        <Probe />
      </ShipProvider>
    );
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  renderer = null;
});

afterEach(() => {
  if (renderer) {
    act(() => renderer?.unmount());
  }
});

describe('ShipProvider splash sequence updates', () => {
  it('merges into the latest stored session without replaying its cookie snapshot', () => {
    let queuedUpdate: ((stored: ShipInfo | null) => ShipInfo | null) | null =
      null;
    mocks.setValue.mockImplementation((value) => {
      if (typeof value === 'function') {
        queuedUpdate = value;
      }
      return Promise.resolve();
    });
    renderProvider();

    act(() => {
      expect(currentShip.startSplashSequence('tlonbotRevival')).toBe(true);
    });

    expect(currentShip.needsSplashSequence).toBe(true);
    expect(currentShip.splashSequenceMode).toBe('tlonbotRevival');
    expect(queuedUpdate).not.toBeNull();

    const refreshed: ShipInfo = {
      ...initialShip,
      authCookie: 'urbauth=fresh',
    };
    expect(queuedUpdate!(refreshed)).toEqual({
      ...refreshed,
      needsSplashSequence: true,
      splashSequenceMode: 'tlonbotRevival',
    });
  });

  it('drops a delayed start after the session has been replaced', () => {
    mocks.setValue.mockResolvedValue(undefined);
    renderProvider();
    const delayedStart = currentShip.startSplashSequence;

    act(() => {
      currentShip.setShip({
        ...initialShip,
        authCookie: 'urbauth=replacement',
      });
    });

    expect(delayedStart('tlonbotRevival')).toBe(false);
    expect(mocks.setValue).toHaveBeenCalledTimes(1);
  });

  it('drops a queued splash update when the session changes before it runs', () => {
    let queuedUpdate: ((stored: ShipInfo | null) => ShipInfo | null) | null =
      null;
    mocks.setValue.mockImplementation((value) => {
      if (typeof value === 'function') {
        queuedUpdate = value;
      }
      return Promise.resolve();
    });
    renderProvider();

    act(() => {
      expect(currentShip.startSplashSequence('tlonbotRevival')).toBe(true);
    });

    const replacement: ShipInfo = {
      ...initialShip,
      ship: '~bus',
      authCookie: 'urbauth=replacement',
    };
    act(() => currentShip.setShip(replacement));

    expect(queuedUpdate).not.toBeNull();
    expect(queuedUpdate!(replacement)).toBe(replacement);
  });
});
