import { da, dr, render } from '@urbit/aura';
import { expect, test, vi } from 'vitest';

import { poke } from '../client/urbit';
import {
  configureGatewayStatus,
  gatewayHeartbeat,
  gatewayStart,
  gatewayStatusAction,
  gatewayStop,
} from '../index';

vi.mock('../client/urbit', () => ({
  poke: vi.fn().mockResolvedValue(undefined),
}));

test('gatewayStatusAction wraps configure action', () => {
  const result = gatewayStatusAction({
    configure: {
      owner: '~zod',
      'active-window': '~h1',
      'offline-reply-cooldown': '~d1',
    },
  });
  expect(result).toStrictEqual({
    app: 'gateway-status',
    mark: 'gateway-status-action-1',
    json: {
      configure: {
        owner: '~zod',
        'active-window': '~h1',
        'offline-reply-cooldown': '~d1',
      },
    },
  });
});

test('gatewayStatusAction wraps gateway-start action', () => {
  const result = gatewayStatusAction({
    'gateway-start': {
      'boot-id': 'abc123',
      'lease-until': '~2026.4.3..12.00.00',
    },
  });
  expect(result.app).toBe('gateway-status');
  expect(result.mark).toBe('gateway-status-action-1');
  expect(result.json).toHaveProperty('gateway-start');
});

test('gatewayStatusAction wraps gateway-stop action', () => {
  const result = gatewayStatusAction({
    'gateway-stop': { 'boot-id': 'boot-xyz', reason: 'shutting down' },
  });
  expect(result.json).toStrictEqual({
    'gateway-stop': { 'boot-id': 'boot-xyz', reason: 'shutting down' },
  });
});

test('configureGatewayStatus converts seconds to @dr and pokes', async () => {
  await configureGatewayStatus({
    owner: '~sampel-palnet',
    activeWindowSecs: 3600,
    offlineReplyCooldownSecs: 86400,
  });
  expect(poke).toHaveBeenCalledWith({
    app: 'gateway-status',
    mark: 'gateway-status-action-1',
    json: {
      configure: {
        owner: '~sampel-palnet',
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
    app: 'gateway-status',
    mark: 'gateway-status-action-1',
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
    app: 'gateway-status',
    mark: 'gateway-status-action-1',
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
    app: 'gateway-status',
    mark: 'gateway-status-action-1',
    json: {
      'gateway-stop': { 'boot-id': 'boot-abc', reason: 'maintenance window' },
    },
  });
});
