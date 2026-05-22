import type { TlawnOAuthGrant, TlawnOAuthProvider } from '@tloncorp/api';
import { createDevLogger } from '@tloncorp/shared';

import { APP_SCHEME } from '../../constants';
import type { BotSettingsProviderRow } from '../../ui';

export const COMPLETION_PATH = 'mcp-oauth/complete';
export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';
export const TOAST_BOTTOM_OFFSET = 24;
export const MCP_TELEMETRY_EVENTS = {
  initiatedOAuth: 'Tlonbot MCP: Initiated OAuth',
  connected: 'Tlonbot MCP: Connected',
  disconnected: 'Tlonbot MCP: Disconnected',
  error: 'Tlonbot MCP: Error',
} as const;

type OAuthCompletion = {
  message: string;
  providerId: string | null;
  success: boolean;
};

const logger = createDevLogger('botSettings', false);

export function buildProviderRows(
  providers: TlawnOAuthProvider[],
  grants: TlawnOAuthGrant[]
): BotSettingsProviderRow[] {
  const grantsByProvider = new Map(
    grants.map((grant) => [grant.provider.toLowerCase(), grant])
  );

  return providers.map((provider) => {
    const grant = grantsByProvider.get(provider.id.toLowerCase()) ?? null;
    const status =
      grant?.connected && !grant.expired
        ? 'connected'
        : grant
          ? 'expired'
          : 'not-connected';

    return {
      displayName: provider.displayName,
      id: provider.id,
      status,
    };
  });
}

export function getFinalRedirectUrl() {
  return `${APP_SCHEME}://${COMPLETION_PATH}`;
}

export function parseOAuthCompletionUrl(
  urlString: string
): OAuthCompletion | null {
  try {
    const url = new URL(urlString);
    const providerId = url.searchParams.get('provider');
    const status =
      url.searchParams.get('status') ?? url.searchParams.get('result');
    const error = url.searchParams.get('error');
    const callbackMessage = url.searchParams.get('message');
    const nativePath = [url.host, url.pathname.replace(/^\//, '')]
      .filter(Boolean)
      .join('/');
    const isNativeCompletion =
      url.protocol.replace(':', '') === APP_SCHEME &&
      nativePath === COMPLETION_PATH;

    if (!isNativeCompletion) {
      return null;
    }

    const normalizedStatus = status?.toLowerCase();
    const success =
      !error && normalizedStatus !== 'error' && normalizedStatus !== 'failed';
    const providerLabel = providerId ? ` for ${providerId}` : '';
    const message = success
      ? callbackMessage || `Connection complete${providerLabel}.`
      : error || callbackMessage || `Connection failed${providerLabel}.`;

    return { message, providerId, success };
  } catch {
    return null;
  }
}

export function trackMcpEvent(
  eventName: (typeof MCP_TELEMETRY_EVENTS)[keyof typeof MCP_TELEMETRY_EVENTS],
  properties: Record<string, unknown> = {}
) {
  logger.trackEvent(eventName, compactTelemetryProperties(properties));
}

export function trackMcpError(
  message: string,
  properties: Record<string, unknown> = {}
) {
  logger.trackError(message, properties);
  trackMcpEvent(MCP_TELEMETRY_EVENTS.error, {
    ...properties,
    errorMessage: message,
  });
}

function compactTelemetryProperties(properties: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(properties)
      .filter(([, value]) => value != null)
      .map(([key, value]) => [key, serializeTelemetryValue(value)])
  );
}

function serializeTelemetryValue(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      details: 'details' in value ? value.details : undefined,
      message: value.message,
      name: value.name,
    };
  }

  return value;
}
