import { createSubsystemLogger } from 'openclaw/plugin-sdk/runtime-env';

import type {
  TlonPluginErrorEvent,
  TlonPluginErrorSource,
  TlonTelemetryClient,
} from './telemetry.js';

export type TlonPluginErrorOtelObserver = {
  recordError(event: TlonPluginErrorEvent): void;
};

type PluginErrorLoggerLike = {
  warn(message: string, meta?: Record<string, unknown>): void;
};

const STRUCTURED_ERROR_SOURCES = new Set<TlonPluginErrorSource>([
  'auth',
  're_auth',
  'gateway_status_activation',
  'gateway_status_heartbeat',
]);
const pluginErrorLogger = createSubsystemLogger('tlon/plugin');

function optionalLogField(
  key: string,
  value: string | number | null
): Record<string, unknown> {
  return value === null ? {} : { [key]: value };
}

function safeObserve(run: () => void): void {
  try {
    run();
  } catch {
    // Observability must never alter authentication or gateway-status behavior.
  }
}

export function createTlonPluginErrorOtelObserver(options?: {
  logger?: PluginErrorLoggerLike;
}): TlonPluginErrorOtelObserver {
  const logger = options?.logger ?? pluginErrorLogger;

  return {
    recordError(event) {
      if (!STRUCTURED_ERROR_SOURCES.has(event.pluginErrorSource)) {
        return;
      }
      safeObserve(() => {
        logger.warn(`tlon.plugin.error: ${event.errorText}`, {
          ...optionalLogField('tlon.plugin.account_id', event.accountId),
          ...optionalLogField('tlon.plugin.attempt', event.attempt),
          ...optionalLogField('tlon.plugin.auth_phase', event.authPhase),
          'tlon.plugin.bot_ship': event.botShip,
          ...optionalLogField('tlon.plugin.down_ms', event.downMs),
          ...optionalLogField('tlon.plugin.error_kind', event.errorKind),
          'tlon.plugin.error_source': event.pluginErrorSource,
          'tlon.plugin.event': 'tlon.plugin.error',
          'tlon.plugin.harness': event.harness,
          ...optionalLogField('tlon.plugin.owner_ship', event.ownerShip),
        });
      });
    },
  };
}

const defaultOtelObserver = createTlonPluginErrorOtelObserver();

export function emitTlonPluginErrorTelemetry(
  event: TlonPluginErrorEvent,
  options?: {
    observer?: TlonPluginErrorOtelObserver;
    postHog?: Pick<TlonTelemetryClient, 'capturePluginError'> | null;
  }
): void {
  options?.postHog?.capturePluginError(event);
  (options?.observer ?? defaultOtelObserver).recordError(event);
}
