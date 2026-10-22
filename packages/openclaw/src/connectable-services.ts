import { readResponseWithLimit } from 'openclaw/plugin-sdk/media-runtime';
import { createSubsystemLogger } from 'openclaw/plugin-sdk/runtime-env';
import { fetchWithSsrFGuard } from 'openclaw/plugin-sdk/ssrf-runtime';

import { sharedSlot } from './shared-state.js';
import { tlonMediaUserAgent } from './version.js';

export type ConnectableService = { id: string; name: string };

// Tlon's OAuth relay serves the same service list the app's Connected
// services screen shows, to every hosted account. Hosted bot containers set
// PIONEER_ENV; anywhere else there is no hosted connection flow to look up.
const CATALOG_URLS: Record<string, string> = {
  prod: 'https://oauth.tlon.io/v1/providers',
  test: 'https://oauth.test.tlon.systems/v1/providers',
};
// The app hides these (packages/app/lib/mcpProviders.ts), so they can't be
// connected even though the relay lists them.
const HIDDEN_SERVICE_IDS = new Set(['supabase']);
const CACHE_MS = 60 * 60_000;
const RETRY_AFTER_FAILURE_MS = 5 * 60_000;
const FETCH_DEADLINE_MS = 10_000;
const MAX_CATALOG_BYTES = 1_000_000;

type CatalogCache = {
  url: string;
  services: ConnectableService[] | null;
  expiresAt: number;
};

const catalogCache = sharedSlot<CatalogCache>('connectableServices.catalog');
const logger = createSubsystemLogger('tlon/connectable-services');

export function resolveConnectableServicesUrl(
  env: NodeJS.ProcessEnv = process.env
): string | null {
  return CATALOG_URLS[(env.PIONEER_ENV ?? '').trim().toLowerCase()] ?? null;
}

export function parseConnectableServices(body: unknown): ConnectableService[] {
  const providers =
    body && typeof body === 'object'
      ? (body as { providers?: unknown }).providers
      : undefined;
  if (!Array.isArray(providers)) {
    throw new Error('service catalog response did not include providers');
  }
  return providers
    .flatMap((provider) => {
      if (!provider || typeof provider !== 'object') return [];
      const { id, displayName } = provider as Record<string, unknown>;
      if (typeof id !== 'string' || !id.trim()) return [];
      if (HIDDEN_SERVICE_IDS.has(id.trim().toLowerCase())) return [];
      const name =
        typeof displayName === 'string' && displayName.trim()
          ? displayName.trim()
          : id.trim();
      return [{ id: id.trim(), name }];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchCatalog(url: string): Promise<unknown> {
  const { response, release } = await fetchWithSsrFGuard({
    url,
    init: {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': tlonMediaUserAgent(),
      },
    },
    auditContext: 'tlon-connectable-services',
    requireHttps: true,
    signal: AbortSignal.timeout(FETCH_DEADLINE_MS),
  });
  try {
    if (!response.ok) {
      throw new Error(`service catalog returned HTTP ${response.status}`);
    }
    const bytes = await readResponseWithLimit(response, MAX_CATALOG_BYTES);
    return JSON.parse(bytes.toString('utf8'));
  } finally {
    await release();
  }
}

/**
 * The services an owner can connect, or null when this bot has no hosted
 * catalog or it can't be loaded right now. Callers must treat null as
 * "unknown", never as "nothing can be connected".
 */
export async function loadConnectableServices(
  deps: {
    url?: string | null;
    fetchJson?: (url: string) => Promise<unknown>;
    now?: () => number;
  } = {}
): Promise<ConnectableService[] | null> {
  const url =
    deps.url === undefined ? resolveConnectableServicesUrl() : deps.url;
  if (!url) return null;
  const now = (deps.now ?? Date.now)();
  const cached = catalogCache.get();
  if (cached && cached.url === url && cached.expiresAt > now) {
    return cached.services;
  }
  try {
    const services = parseConnectableServices(
      await (deps.fetchJson ?? fetchCatalog)(url)
    );
    catalogCache.set({ url, services, expiresAt: now + CACHE_MS });
    return services;
  } catch (error) {
    // Keep serving the last good list through a relay outage, and back off
    // either way so every turn doesn't wait on a dead endpoint.
    const services =
      cached?.url === url && cached.services ? cached.services : null;
    logger.warn('tlon.connectable_services.fetch_failed', {
      url,
      error: error instanceof Error ? error.message : String(error),
      servingCachedList: Boolean(services),
    });
    catalogCache.set({
      url,
      services,
      expiresAt: now + RETRY_AFTER_FAILURE_MS,
    });
    return services;
  }
}

export function resetConnectableServicesCache() {
  catalogCache.set(null);
}

function normalizeServiceKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function findConnectableService(
  services: readonly ConnectableService[],
  query: string
): ConnectableService | null {
  const key = normalizeServiceKey(query);
  if (!key) return null;
  return (
    services.find(
      (service) =>
        normalizeServiceKey(service.id) === key ||
        normalizeServiceKey(service.name) === key
    ) ?? null
  );
}

export function formatConnectableServices(
  services: readonly ConnectableService[]
) {
  return services
    .map((service) => `${service.name} (${service.id})`)
    .join(', ');
}

export const connectableServicesToolMetadata = {
  name: 'tlon_connectable_services',
  label: 'Tlon Connectable Services',
  description:
    'List the outside services the owner can connect to this bot under Connected services. The list is the same for every hosted account. Use it before saying whether a service can be connected or offering to connect one.',
  promptSnippet:
    '`tlon_connectable_services`: the exact list of services the owner can connect',
  promptGuidelines: [
    'Before saying whether a service like a calendar, email, or project tool can be connected, or offering to connect one, call `tlon_connectable_services` and answer from its list by name. If the service is not on it, say plainly that it cannot be connected yet and name the closest services that can. Never guess, and never say a service is probably or maybe available.',
  ],
};

export const connectableServicesToolParameters = {
  type: 'object',
  properties: {},
  additionalProperties: false,
} as const;

export function createConnectableServicesToolExecutor(deps: {
  listServices: () => Promise<ConnectableService[] | null>;
}) {
  return async function execute() {
    const services = await deps.listServices();
    if (!services) {
      return {
        content: [
          {
            type: 'text' as const,
            text:
              "Error: the list of connectable services couldn't be loaded right now. " +
              "Don't guess: say you can't check at the moment and point the owner to Connected services in the bot's settings.",
          },
        ],
        details: { error: true },
      };
    }
    return {
      content: [
        {
          type: 'text' as const,
          text:
            `Services the owner can connect under Connected services: ${formatConnectableServices(services)}. ` +
            'A service not on this list cannot be connected yet. ' +
            'This list does not say which ones are connected now; check that with a small real call before relying on one.',
        },
      ],
      details: undefined,
    };
  };
}
