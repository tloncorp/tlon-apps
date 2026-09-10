import { da, dr, render } from '@urbit/aura';
import { beforeEach, expect, test, vi } from 'vitest';

import { poke } from '../client/urbit';
import {
  configureStewardGateway,
  gatewayHeartbeat,
  gatewayStart,
  gatewayStop,
  stewardGatewayAction,
} from '../index';

vi.mock('../client/urbit', () => ({
  poke: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  vi.mocked(poke).mockClear();
});

test('stewardGatewayAction wraps configure action', () => {
  const result = stewardGatewayAction({
    configure: {
      'active-window': '~h1',
      'offline-reply-cooldown': '~d1',
    },
  });
  expect(result).toStrictEqual({
    app: 'steward',
    mark: 'steward-gateway-action-1',
    json: {
      configure: {
        'active-window': '~h1',
        'offline-reply-cooldown': '~d1',
      },
    },
  });
});

test('stewardGatewayAction wraps gateway-start action', () => {
  const result = stewardGatewayAction({
    'gateway-start': {
      'boot-id': 'abc123',
      'lease-until': '~2026.4.3..12.00.00',
    },
  });
  expect(result.app).toBe('steward');
  expect(result.mark).toBe('steward-gateway-action-1');
  expect(result.json).toHaveProperty('gateway-start');
});

test('stewardGatewayAction wraps gateway-stop action', () => {
  const result = stewardGatewayAction({
    'gateway-stop': { 'boot-id': 'boot-xyz', reason: 'shutting down' },
  });
  expect(result.json).toStrictEqual({
    'gateway-stop': { 'boot-id': 'boot-xyz', reason: 'shutting down' },
  });
});

test('configureStewardGateway sets the core owner before the gateway timings', async () => {
  await configureStewardGateway({
    owner: '~sampel-palnet',
    activeWindowSecs: 3600,
    offlineReplyCooldownSecs: 86400,
  });
  expect(poke).toHaveBeenCalledTimes(2);
  expect(vi.mocked(poke).mock.calls[0][0]).toStrictEqual({
    app: 'steward',
    mark: 'steward-action-1',
    json: { configure: { owner: '~sampel-palnet' } },
  });
  expect(vi.mocked(poke).mock.calls[1][0]).toStrictEqual({
    app: 'steward',
    mark: 'steward-gateway-action-1',
    json: {
      configure: {
        'active-window': render('dr', dr.fromSeconds(BigInt(3600))),
        'offline-reply-cooldown': render('dr', dr.fromSeconds(BigInt(86400))),
      },
    },
  });
});

test('gatewayStart converts Unix millis to @da and pokes', async () => {
  const leaseUntil = 1743638400000;
  await gatewayStart({ bootId: 'boot-xyz', leaseUntil });
  expect(poke).toHaveBeenCalledWith({
    app: 'steward',
    mark: 'steward-gateway-action-1',
    json: {
      'gateway-start': {
        'boot-id': 'boot-xyz',
        'lease-until': render('da', da.fromUnix(leaseUntil)),
      },
    },
  });
});

test('gatewayHeartbeat converts Unix millis to @da and pokes', async () => {
  const leaseUntil = 1743638400000;
  await gatewayHeartbeat({ bootId: 'boot-xyz', leaseUntil });
  expect(poke).toHaveBeenCalledWith({
    app: 'steward',
    mark: 'steward-gateway-action-1',
    json: {
      'gateway-heartbeat': {
        'boot-id': 'boot-xyz',
        'lease-until': render('da', da.fromUnix(leaseUntil)),
      },
    },
  });
});

test('gatewayStop pokes with boot-id and reason', async () => {
  await gatewayStop({ bootId: 'boot-abc', reason: 'maintenance window' });
  expect(poke).toHaveBeenCalledWith({
    app: 'steward',
    mark: 'steward-gateway-action-1',
    json: {
      'gateway-stop': { 'boot-id': 'boot-abc', reason: 'maintenance window' },
    },
  });
});
