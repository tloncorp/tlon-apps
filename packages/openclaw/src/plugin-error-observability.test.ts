import { describe, expect, it, vi } from 'vitest';

import {
  createTlonPluginErrorOtelObserver,
  emitTlonPluginErrorTelemetry,
} from './plugin-error-observability.js';
import type {
  TlonPluginErrorEvent,
  TlonPluginErrorSource,
} from './telemetry.js';

const selectedSources: TlonPluginErrorSource[] = [
  'auth',
  're_auth',
  'gateway_status_activation',
  'gateway_status_heartbeat',
];

function pluginErrorEvent(
  overrides: Partial<TlonPluginErrorEvent> = {}
): TlonPluginErrorEvent {
  return {
    accountId: 'default',
    attempt: 3,
    authPhase: 're_auth',
    botShip: '~bot',
    downMs: 45_000,
    errorKind: 'http_401',
    errorText: 'unauthorized',
    harness: 'openclaw',
    ownerShip: '~owner',
    pluginErrorSource: 're_auth',
    ...overrides,
  };
}

describe('Tlon plugin error OTEL observer', () => {
  it('mirrors the PostHog event into a structured warning', () => {
    const warn = vi.fn();
    const capturePluginError = vi.fn();
    const observer = createTlonPluginErrorOtelObserver({
      logger: { warn },
    });
    const event = pluginErrorEvent();

    emitTlonPluginErrorTelemetry(event, {
      observer,
      postHog: { capturePluginError },
    });

    expect(capturePluginError.mock.calls[0]?.[0]).toBe(event);
    expect(warn).toHaveBeenCalledWith('tlon.plugin.error: unauthorized', {
      'tlon.plugin.account_id': 'default',
      'tlon.plugin.attempt': 3,
      'tlon.plugin.auth_phase': 're_auth',
      'tlon.plugin.bot_ship': '~bot',
      'tlon.plugin.down_ms': 45_000,
      'tlon.plugin.error_kind': 'http_401',
      'tlon.plugin.error_source': 're_auth',
      'tlon.plugin.event': 'tlon.plugin.error',
      'tlon.plugin.harness': 'openclaw',
      'tlon.plugin.owner_ship': '~owner',
    });
  });

  it('selects only auth and gateway-status plugin errors', () => {
    const warn = vi.fn();
    const observer = createTlonPluginErrorOtelObserver({
      logger: { warn },
    });

    for (const pluginErrorSource of selectedSources) {
      observer.recordError(pluginErrorEvent({ pluginErrorSource }));
    }
    observer.recordError(
      pluginErrorEvent({ pluginErrorSource: 'chat_firehose' })
    );

    expect(
      warn.mock.calls.map(
        (call) =>
          (call[1] as Record<string, unknown>)['tlon.plugin.error_source']
      )
    ).toEqual(selectedSources);
  });

  it('emits without PostHog and omits null optional properties', () => {
    const warn = vi.fn();
    const observer = createTlonPluginErrorOtelObserver({
      logger: { warn },
    });
    const event = pluginErrorEvent({
      accountId: null,
      attempt: null,
      authPhase: null,
      downMs: null,
      errorKind: null,
      errorText: 'heartbeat failed',
      ownerShip: null,
      pluginErrorSource: 'gateway_status_heartbeat',
    });

    emitTlonPluginErrorTelemetry(event, { observer });

    expect(warn).toHaveBeenCalledWith('tlon.plugin.error: heartbeat failed', {
      'tlon.plugin.bot_ship': '~bot',
      'tlon.plugin.error_source': 'gateway_status_heartbeat',
      'tlon.plugin.event': 'tlon.plugin.error',
      'tlon.plugin.harness': 'openclaw',
    });
  });

  it('keeps excluded sources in PostHog without emitting OTEL', () => {
    const warn = vi.fn();
    const capturePluginError = vi.fn();
    const observer = createTlonPluginErrorOtelObserver({
      logger: { warn },
    });
    const event = pluginErrorEvent({
      pluginErrorSource: 'channels_firehose',
    });

    emitTlonPluginErrorTelemetry(event, {
      observer,
      postHog: { capturePluginError },
    });

    expect(capturePluginError).toHaveBeenCalledWith(event);
    expect(warn).not.toHaveBeenCalled();
  });

  it('does not let logger failures affect plugin behavior', () => {
    const observer = createTlonPluginErrorOtelObserver({
      logger: {
        warn: () => {
          throw new Error('logger unavailable');
        },
      },
    });

    expect(() => observer.recordError(pluginErrorEvent())).not.toThrow();
  });
});
